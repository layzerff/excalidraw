import { parseEmbed } from './embeds.mjs';
// Browser adapter: the NAS SQLite service is authoritative. No privileged
// Electron API, arbitrary filesystem access, or password is exposed to frames.
export function createWebBridge(win) {
  const doc = win.document,
    handles = new Map(),
    downloads = new Map();
  async function api(action, ...args) {
    const response = await win.fetch(new URL('api/workspace', doc.baseURI), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Local-Canvas': '1' },
      body: JSON.stringify({ action, args }),
    });
    if (response.status === 401)
      throw new Error('NAS 登录已失效，请保留此页并重新登录');
    const result = await response.json();
    if (!response.ok || result.error)
      throw new Error(result.error || 'NAS 保存失败');
    return result.value;
  }
  const safeName = (title) => String(title).replace(/[\\/:*?"<>|]/g, '_');
  function download(value, name, type = 'application/json') {
    const blob =
      value instanceof win.Blob
        ? value
        : new win.Blob(
            [
              typeof value === 'string'
                ? value
                : JSON.stringify(value, null, 2),
            ],
            { type },
          );
    const url = win.URL.createObjectURL(blob),
      a = doc.createElement('a');
    a.href = url;
    a.download = name;
    doc.body.append(a);
    a.click();
    a.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 60000);
    return true;
  }
  function openFile(accept = '.json,.excalidraw') {
    return new Promise((resolve, reject) => {
      const input = doc.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      doc.body.append(input);
      input.addEventListener(
        'cancel',
        () => {
          input.remove();
          resolve(null);
        },
        { once: true },
      );
      input.onchange = async () => {
        try {
          const file = input.files[0];
          if (!file) {
            resolve(null);
            return;
          }
          if (file.size > 100 * 1024 * 1024) throw new Error('文件超过 100 MB');
          resolve({ value: JSON.parse(await file.text()), name: file.name });
        } catch (e) {
          reject(e);
        } finally {
          input.remove();
        }
      };
      input.click();
    });
  }
  const nativeData = (value) => ({
    elements: value.elements,
    appState: value.appState || {},
    files: value.files || {},
    scenes: value.localCanvas?.scenes || [],
    balloonNext: value.localCanvas?.balloonNext || 1,
    balloonSize: value.localCanvas?.balloonSize,
    libraryItems: value.localCanvas?.libraryItems || [],
  });
  async function importDoc(parent) {
    const picked = await openFile();
    if (!picked) return null;
    const { value, name } = picked,
      data =
        value.type === 'excalidraw'
          ? nativeData(value)
          : value.format === 'local-canvas-document' && value.version === 1
            ? value.data
            : null;
    if (!data) throw new Error('请选择 Excalidraw 或 Local Canvas 文档');
    return api(
      'importData',
      parent,
      value.title || name.replace(/\.(canvas\.json|excalidraw|json)$/i, ''),
      data,
    );
  }
  const serialize = (title, data, native) =>
    native
      ? {
          type: 'excalidraw',
          version: 2,
          source: 'local-canvas',
          elements: data.elements,
          appState: data.appState,
          files: data.files,
          localCanvas: {
            scenes: data.scenes,
            balloonNext: data.balloonNext || 1,
            balloonSize: data.balloonSize,
            libraryItems: data.libraryItems || [],
          },
        }
      : { format: 'local-canvas-document', version: 1, title, data };
  const local = {
    setEmbedOrigins: () => true,
    openExternalPage: (value) => {
      const e = parseEmbed(value);
      if (!e) throw Error('只允许 HTTPS 网页地址');
      win.open(e.url, '_blank', 'noopener,noreferrer');
    },
    openLibraries: () => {
      const url = new URL('https://libraries.excalidraw.com/');
      url.search = new URLSearchParams({
        referrer: win.location.origin + win.location.pathname,
        useHash: 'true',
        version: '2',
        target: '_blank',
      });
      win.open(url.href, '_blank', 'noopener,noreferrer');
    },
    pendingLibrary: () => {
      const params = new URLSearchParams(win.location.hash.slice(1));
      const value = params.get('addLibrary');
      if (value)
        win.history.replaceState(
          null,
          '',
          win.location.pathname + win.location.search,
        );
      return value;
    },
    openProject: () =>
      win.open('https://github.com/layzerff/excalidraw', '_blank', 'noopener'),
    pauseVideos: () => true, // Official postMessage player command is sent by VideoEmbed.
    openDocument: importDoc,
    importDocument: importDoc,
    backup: async () =>
      download(await api('backup'), `local-canvas-backup-${Date.now()}.json`),
    restore: async () => {
      const picked = await openFile();
      return picked ? api('restore', picked.value) : null;
    },
    importLibrary: async () => {
      const picked = await openFile('.excalidrawlib,.json');
      return picked?.value || null;
    },
    saveAsDocument: async (id, data) => {
      const node = await api('read', id),
        name = safeName(node.title) + '.canvas.json',
        value = serialize(node.title, data, false);
      if (win.showSaveFilePicker && win.isSecureContext) {
        try {
          const handle = await win.showSaveFilePicker({
            suggestedName: name,
            types: [
              {
                description: 'Local Canvas 完整白板',
                accept: { 'application/json': ['.json'] },
              },
            ],
          });
          const stream = await handle.createWritable();
          await stream.write(JSON.stringify(value));
          await stream.close();
          handles.set(id, handle);
          return { path: handle.name };
        } catch (e) {
          if (e.name === 'AbortError') return null;
          throw e;
        }
      }
      download(value, name);
      downloads.set(id, name);
      return { path: name };
    },
    exportDocument: async (id, data, native) => {
      const node = await api('read', id);
      return download(
        serialize(node.title, data, native),
        safeName(node.title) + (native ? '.excalidraw' : '.canvas.json'),
      );
    },
    exportGraphic: (title, format, value) =>
      download(
        format === 'png'
          ? new win.Blob(
              [
                Uint8Array.from(win.atob(value.split(',')[1]), (c) =>
                  c.charCodeAt(0),
                ),
              ],
              { type: 'image/png' },
            )
          : value,
        safeName(title) + '.' + format,
        format === 'svg' ? 'image/svg+xml' : 'image/png',
      ),
    exportPDF: async (title, pages) => {
      const frame = doc.createElement('iframe');
      frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-100px';
      frame.title = '打印 PDF';
      const html = `<!doctype html><title>${safeName(title).replace(/[<>&]/g, '_')}</title><style>@page{size:A4 landscape;margin:0}body{margin:0}section{width:297mm;height:210mm;display:flex;align-items:center;justify-content:center;break-after:page}section:last-child{break-after:auto}img{max-width:287mm;max-height:200mm}</style>${pages.map((p) => `<section><img src="${p}"></section>`).join('')}`;
      const url = win.URL.createObjectURL(
        new win.Blob([html], { type: 'text/html' }),
      );
      const loaded = new Promise((resolve) => {
        frame.onload = resolve;
      });
      frame.src = url;
      doc.body.append(frame);
      await loaded;
      await Promise.all(
        [...frame.contentDocument.images].map((i) => i.decode()),
      );
      frame.contentWindow.focus();
      frame.contentWindow.print();
      win.setTimeout(() => {
        frame.remove();
        win.URL.revokeObjectURL(url);
      }, 60000);
      return true;
    },
    changeStorage: () => {
      throw new Error('NAS 版请在容器配置中更改 /data 的映射目录');
    },
    restart: () => win.location.reload(),
  };
  return {
    kind: 'web',
    invoke: async (action, ...args) =>
      Object.hasOwn(local, action)
        ? local[action](...args)
        : api(action, ...args),
    save: (...args) => api('save', ...args),
    saveFile: async (id, data) => {
      const handle = handles.get(id);
      if (handle) {
        const node = await api('read', id),
          stream = await handle.createWritable();
        await stream.write(JSON.stringify(serialize(node.title, data, false)));
        await stream.close();
        return true;
      }
      if (downloads.has(id)) {
        const node = await api('read', id);
        download(serialize(node.title, data, false), downloads.get(id));
        return true;
      }
      return false;
    },
  };
}
