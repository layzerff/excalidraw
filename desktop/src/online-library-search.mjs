import { libraryMetadata } from './library-search.mjs';
import { matchText } from './search.mjs';

// Queries never leave the app: fetch the public catalog/packages, then match
// names, tags and embedded text locally. Index text stays small; shape payloads
// use a bounded cache and requests are shared across typing/search changes.
export function onlineLibraryIndex(bridge) {
  let catalogPromise,
    bytes = 0;
  const summaries = new Map(),
    payloads = new Map();
  const catalog = () =>
    (catalogPromise ||= bridge.invoke('libraryCatalog').catch((e) => {
      catalogPromise = null;
      throw e;
    }));
  const load = (source) => {
    if (payloads.has(source)) {
      const value = payloads.get(source);
      payloads.delete(source);
      payloads.set(source, value);
      return value.promise;
    }
    const entry = { bytes: 0, promise: null };
    entry.promise = bridge
      .invoke('downloadLibrary', source)
      .then((lib) => {
        const items = (lib.libraryItems || lib.library || []).map(
          (item, index) =>
            Array.isArray(item)
              ? { id: `${source}#${index}`, elements: item }
              : item,
        );
        entry.bytes = JSON.stringify(items).length * 2;
        bytes += entry.bytes;
        for (const [key, value] of payloads) {
          if (bytes <= 64 * 1024 * 1024) break;
          if (key !== source && value.bytes) {
            bytes -= value.bytes;
            payloads.delete(key);
          }
        }
        return items;
      })
      .catch((e) => {
        payloads.delete(source);
        throw e;
      });
    payloads.set(source, entry);
    return entry.promise;
  };
  async function search(query, update, cancelled = () => false) {
    const entries = await catalog();
    if (cancelled()) return;
    let cursor = 0,
      done = 0,
      failed = 0;
    const results = [];
    const report = (working) => {
      if (!cancelled())
        update({
          results: [...results],
          done,
          total: entries.length,
          failed,
          working,
        });
    };
    report(true);
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (!cancelled() && cursor < entries.length) {
          const entry = entries[cursor++];
          try {
            let index = summaries.get(entry.source);
            if (!index) {
              const items = await load(entry.source);
              index = items.map((item, i) => ({
                index: i,
                ...libraryMetadata(item),
              }));
              summaries.set(entry.source, index);
            }
            if (cancelled()) return;
            const packageMatch = matchText(
              [entry.name, entry.description, entry.authors].join(' '),
              query,
            );
            for (const item of index)
              if (
                packageMatch ||
                matchText(
                  [item.name, ...item.tags, item.internal].join(' '),
                  query,
                )
              )
                results.push({
                  source: entry.source,
                  index: item.index,
                  packageName: entry.name,
                  name:
                    item.name ||
                    item.internal ||
                    `${entry.name} ${item.index + 1}`,
                });
          } catch {
            failed++;
          }
          done++;
          report(true);
        }
      }),
    );
    report(false);
  }
  return {
    catalog,
    packageItems: load,
    search,
    item: async (ref) => (await load(ref.source))[ref.index],
  };
}
