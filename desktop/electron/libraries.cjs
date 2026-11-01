const { randomBytes } = require('node:crypto');
function sourceURL(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port)
      return null;
    if (
      (u.hostname === 'libraries.excalidraw.com' &&
        u.pathname.startsWith('/libraries/')) ||
      (u.hostname === 'raw.githubusercontent.com' &&
        u.pathname.startsWith('/excalidraw/excalidraw-libraries/'))
    ) {
      if (!u.pathname.endsWith('.excalidrawlib')) return null;
      return u.href;
    }
  } catch {}
  return null;
}
function validateLibrary(value) {
  if (
    value?.type !== 'excalidrawlib' ||
    !Array.isArray(value.libraryItems || value.library)
  )
    throw Error('请选择有效的 .excalidrawlib 素材库');
  return value;
}
async function downloadLibrary(value, fetcher = fetch) {
  let url = sourceURL(value);
  if (!url) throw Error('仅允许官方目录的素材库地址');
  const signal = AbortSignal.timeout(30000);
  for (let i = 0; i < 5; i++) {
    const res = await fetcher(url, {
      redirect: 'manual',
      signal,
      credentials: 'omit',
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      url = sourceURL(new URL(res.headers.get('location'), url).href);
      if (!url) throw Error('素材库重定向地址不受信任');
      continue;
    }
    if (!res.ok) throw Error(`素材库下载失败 (${res.status})`);
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > 50 * 1024 * 1024) {
        await res.body.cancel?.().catch(() => {});
        throw Error('素材库超过 50 MB');
      }
      chunks.push(Buffer.from(chunk));
    }
    return validateLibrary(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  }
  throw Error('素材库重定向过多');
}
class LibraryLink {
  constructor() {
    this.token = randomBytes(24).toString('hex');
    this.pending = null;
    this.opened = false;
  }
  catalog() {
    this.opened = true;
    return (
      'https://libraries.excalidraw.com/?' +
      new URLSearchParams({
        referrer: 'localcanvas://library',
        useHash: 'true',
        token: this.token,
        version: '2',
        target: '_self',
      })
    );
  }
  receive(value) {
    try {
      const u = new URL(value),
        p = new URLSearchParams(u.hash.slice(1) || u.search.slice(1));
      const source = sourceURL(p.get('addLibrary'));
      if (
        this.opened &&
        u.protocol === 'localcanvas:' &&
        u.hostname === 'library' &&
        p.get('token') === this.token &&
        source
      ) {
        this.pending = source;
        return true;
      }
    } catch {}
    return false;
  }
  take() {
    const v = this.pending;
    this.pending = null;
    return v;
  }
}
module.exports = { sourceURL, validateLibrary, downloadLibrary, LibraryLink };

async function libraryCatalog(fetcher = fetch) {
  const res = await fetcher('https://libraries.excalidraw.com/libraries.json', {
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    credentials: 'omit',
  });
  if (!res.ok) throw Error(`素材目录加载失败 (${res.status})`);
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) throw Error('素材目录过大');
    chunks.push(Buffer.from(chunk));
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(data)) throw Error('无效素材目录');
  return data.slice(0, 10000).flatMap((item) => {
    const source = sourceURL(
      new URL(item.source || '', 'https://libraries.excalidraw.com/libraries/')
        .href,
    );
    return source
      ? [
          {
            source,
            name: String(item.name || item.source).slice(0, 300),
            description: String(item.description || '').slice(0, 1000),
            authors: Array.isArray(item.authors)
              ? item.authors
                  .map((a) => String(a.name || ''))
                  .join(', ')
                  .slice(0, 300)
              : '',
          },
        ]
      : [];
  });
}
module.exports.libraryCatalog = libraryCatalog;
