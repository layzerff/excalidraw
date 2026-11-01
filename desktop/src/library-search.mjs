import { matchText } from './search.mjs';
export function libraryMetadata(item) {
  const stored =
    item.elements?.find((e) => e.customData?.localCanvasLibrary)?.customData
      .localCanvasLibrary || {};
  const internal = (item.elements || [])
    .filter((e) => e.type === 'text' && !e.isDeleted)
    .map((e) => e.originalText || e.text || '')
    .join(' ');
  return {
    name: stored.name || item.name || item.title || '',
    tags: Array.isArray(stored.tags)
      ? stored.tags
      : Array.isArray(item.tags)
        ? item.tags
        : Array.isArray(item.keywords)
          ? item.keywords
          : [],
    internal,
  };
}
export function searchLibrary(items, query) {
  if (!query.trim()) return items;
  return items.filter((item) => {
    const m = libraryMetadata(item);
    return !!matchText([m.name, ...m.tags, m.internal].join(' '), query);
  });
}
export function renameLibraryItem(item, name, tags) {
  const metadata = {
    name: String(name).trim().slice(0, 200),
    tags: String(tags)
      .split(/[,，;；\n]/)
      .map((t) => t.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 20),
  };
  return {
    ...item,
    name: metadata.name,
    elements: item.elements.map((e, i) =>
      i === 0
        ? {
            ...e,
            customData: { ...e.customData, localCanvasLibrary: metadata },
            version: e.version + 1,
          }
        : e,
    ),
  };
}
