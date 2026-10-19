const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { basename } = require('node:path');
const { Store, payload } = require('./store.cjs');
const { backup: backupDatabase } = require('node:sqlite');
const { isAbsolute } = require('node:path');
let win, store;
app.setName('Local Canvas');
app.setPath(
  'userData',
  process.env.LOCAL_CANVAS_DATA || join(app.getPath('appData'), 'Local Canvas'),
);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    win?.show();
    win?.focus();
  });
  app
    .whenReady()
    .then(() => {
      const locationFile = join(
        app.getPath('userData'),
        'storage-location.json',
      );
      let storageRoot = app.getPath('userData');
      if (fs.existsSync(locationFile)) {
        const location = JSON.parse(fs.readFileSync(locationFile, 'utf8')).path;
        if (
          typeof location !== 'string' ||
          !isAbsolute(location) ||
          !fs.existsSync(join(location, 'workspace.sqlite'))
        )
          throw new Error('自定义工作区不可用，请连接对应磁盘后重启');
        storageRoot = location;
      }
      store = new Store(join(storageRoot, 'workspace.sqlite'));
      const getLink = (id) =>
        JSON.parse(store.getSetting(`documentFile:${id}`) || 'null');
      const backupDir = join(storageRoot, 'backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const snapshot = join(
        backupDir,
        `workspace-${new Date().toISOString().slice(0, 10)}.json`,
      );
      if (!fs.existsSync(snapshot)) {
        const fd = fs.openSync(`${snapshot}.tmp`, 'w');
        try {
          fs.writeFileSync(fd, JSON.stringify(store.backup()));
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        fs.renameSync(`${snapshot}.tmp`, snapshot);
      }
      const url = pathToFileURL(join(__dirname, '../dist/index.html')).href;
      const trusted = (event) => {
        if (
          event.sender !== win?.webContents ||
          event.senderFrame !== win.webContents.mainFrame ||
          event.senderFrame.url.split('#')[0] !== url
        )
          throw new Error('拒绝未知来源');
      };
      const operations = {
        list: () => store.list(),
        read: (id) => ({
          ...store.read(id),
          fileLink: getLink(id),
        }),
        create: (...args) => store.create(...args),
        rename: (...args) => store.rename(...args),
        move: (...args) => store.move(...args),
        trash: (...args) => store.trash(...args),
        getSetting: (key) =>
          ['sidebarWidths', 'collapsedFolders'].includes(key)
            ? JSON.parse(store.getSetting(key) || 'null')
            : store.getSetting(key),
        setSetting: (key, value) => {
          if (key.startsWith('documentFile:'))
            throw new Error('文件关联只能通过系统文件窗口设置');
          return store.setSetting(
            key,
            ['sidebarWidths', 'collapsedFolders'].includes(key)
              ? JSON.stringify(value)
              : value,
          );
        },
        fileInfo: (id) => ({
          file: getLink(id)?.path || null,
          database: join(storageRoot, 'workspace.sqlite'),
        }),
        async openDocument(parent) {
          const result = await dialog.showOpenDialog(win, {
            title: '打开白板文件',
            properties: ['openFile'],
            filters: [{ name: '白板文件', extensions: ['json', 'excalidraw'] }],
          });
          if (result.canceled) return null;
          const path = result.filePaths[0];
          if (fs.statSync(path).size > 100 * 1024 * 1024)
            throw new Error('文件超过 100 MB');
          const bytes = fs.readFileSync(path),
            hash = digest(bytes),
            value = JSON.parse(bytes);
          const native = value.type === 'excalidraw';
          const data = native
            ? {
                elements: value.elements,
                appState: value.appState || {},
                files: value.files || {},
                scenes: value.localCanvas?.scenes || [],
                libraryItems: value.localCanvas?.libraryItems || [],
              }
            : value.format === 'local-canvas-document' && value.version === 1
              ? value.data
              : null;
          payload(data);
          const existing = store
            .list()
            .find(
              (node) =>
                !node.deleted &&
                node.kind === 'document' &&
                getLink(node.id)?.path === path &&
                getLink(node.id)?.hash === hash,
            );
          if (existing) return existing.id;
          const id = store.create(
            'document',
            parent,
            value.title ||
              basename(path).replace(/\.(canvas\.json|excalidraw|json)$/i, ''),
            data,
          );
          store.setSetting(
            `documentFile:${id}`,
            JSON.stringify({ path, hash, native }),
          );
          return id;
        },
        async saveAsDocument(id, data) {
          payload(data);
          const node = store.node(id);
          const result = await dialog.showSaveDialog(win, {
            title: '另存为白板文件',
            defaultPath: `${node.title.replace(/[\\/:*?"<>|]/g, '_')}.canvas.json`,
            filters: [
              { name: 'Local Canvas 完整白板', extensions: ['json'] },
              { name: 'Excalidraw 白板', extensions: ['excalidraw'] },
            ],
          });
          if (result.canceled) return null;
          const link = {
            path: result.filePath,
            native: result.filePath.endsWith('.excalidraw'),
          };
          link.hash = writeLinked(link, node.title, data);
          store.setSetting(`documentFile:${id}`, JSON.stringify(link));
          return link;
        },
        storageInfo: () => ({
          folder: storageRoot,
          database: join(storageRoot, 'workspace.sqlite'),
          backups: backupDir,
        }),
        async changeStorage() {
          const result = await dialog.showOpenDialog(win, {
            title: '选择工作区保存文件夹（迁移后需重启）',
            properties: ['openDirectory', 'createDirectory'],
          });
          if (result.canceled) return null;
          const target = join(result.filePaths[0], 'Local Canvas');
          if (fs.existsSync(target) && fs.readdirSync(target).length)
            throw new Error('目标 Local Canvas 文件夹非空，请选择其他位置');
          fs.mkdirSync(target, { recursive: true });
          await backupDatabase(store.db, join(target, 'workspace.sqlite'));
          fs.cpSync(backupDir, join(target, 'backups'), {
            recursive: true,
            force: false,
            errorOnExist: true,
          });
          const temporary = `${locationFile}.tmp`;
          fs.writeFileSync(temporary, JSON.stringify({ path: target }));
          fs.renameSync(temporary, locationFile);
          return { folder: target };
        },
        restart: () => {
          app.relaunch();
          app.quit();
        },
        async exportGraphic(title, format, value) {
          if (
            !['png', 'svg'].includes(format) ||
            typeof value !== 'string' ||
            value.length > 200 * 1024 * 1024
          )
            throw new Error('导出数据无效');
          if (
            format === 'png' &&
            !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)
          )
            throw new Error('PNG 数据无效');
          if (format === 'svg' && !value.startsWith('<svg'))
            throw new Error('SVG 数据无效');
          const result = await dialog.showSaveDialog(win, {
            defaultPath: `${String(title).replace(/[\\/:*?"<>|]/g, '_')}.${format}`,
            filters: [{ name: format.toUpperCase(), extensions: [format] }],
          });
          if (result.canceled) return false;
          const temporary = `${result.filePath}.${process.pid}.tmp`;
          const fd = fs.openSync(temporary, 'wx');
          try {
            fs.writeFileSync(
              fd,
              format === 'png'
                ? Buffer.from(value.split(',')[1], 'base64')
                : value,
            );
            fs.fsyncSync(fd);
          } finally {
            fs.closeSync(fd);
          }
          try {
            fs.renameSync(temporary, result.filePath);
          } catch (error) {
            fs.unlinkSync(temporary);
            throw error;
          }
          return true;
        },
        async importLibrary() {
          const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            filters: [
              {
                name: 'Excalidraw 素材库',
                extensions: ['excalidrawlib', 'json'],
              },
            ],
          });
          if (result.canceled) return null;
          if (fs.statSync(result.filePaths[0]).size > 50 * 1024 * 1024)
            throw new Error('素材库超过 50 MB');
          const value = JSON.parse(
            fs.readFileSync(result.filePaths[0], 'utf8'),
          );
          if (
            value.type !== 'excalidrawlib' ||
            !Array.isArray(value.libraryItems || value.library)
          )
            throw new Error('请选择有效的 .excalidrawlib 素材库');
          return value;
        },
        async exportPDF(title, pages) {
          if (
            !Array.isArray(pages) ||
            !pages.length ||
            pages.length > 200 ||
            pages.some(
              (p) =>
                typeof p !== 'string' ||
                !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p),
            )
          )
            throw new Error('PDF 页面无效（最多 200 页）');
          const result = await dialog.showSaveDialog(win, {
            defaultPath: `${String(title).replace(/[\\/:*?"<>|]/g, '_')}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
          });
          if (result.canceled) return false;
          const printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
              sandbox: true,
              contextIsolation: true,
              nodeIntegration: false,
            },
          });
          try {
            const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>@page{size:A4 landscape;margin:0}body{margin:0}section{width:297mm;height:210mm;display:flex;align-items:center;justify-content:center;break-after:page}section:last-child{break-after:auto}img{max-width:287mm;max-height:200mm;object-fit:contain}</style></head><body>${pages.map((p) => `<section><img src="${p}"></section>`).join('')}</body></html>`;
            await printWindow.loadURL(
              `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
            );
            const pdf = await printWindow.webContents.printToPDF({
              landscape: true,
              printBackground: true,
              preferCSSPageSize: true,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            });
            const temporary = `${result.filePath}.${process.pid}.tmp`;
            fs.writeFileSync(temporary, pdf, { flag: 'wx' });
            fs.renameSync(temporary, result.filePath);
            return true;
          } finally {
            printWindow.destroy();
          }
        },
        async exportDocument(id, data, native) {
          payload(data);
          const node = store.node(id);
          const value = native
            ? {
                type: 'excalidraw',
                version: 2,
                source: 'local-canvas',
                elements: data.elements,
                appState: data.appState,
                files: data.files,
              }
            : {
                format: 'local-canvas-document',
                version: 1,
                title: node.title,
                data,
              };
          return saveFile(
            value,
            `${node.title.replace(/[\\/:*?"<>|]/g, '_')}.${native ? 'excalidraw' : 'canvas.json'}`,
          );
        },
        async importDocument(parent) {
          const value = await openFile();
          if (!value) return null;
          let data, title;
          if (value.format === 'local-canvas-document' && value.version === 1) {
            data = value.data;
            title = value.title;
          } else if (
            value.type === 'excalidraw' &&
            Array.isArray(value.elements)
          ) {
            data = {
              elements: value.elements,
              appState: value.appState || {},
              files: value.files || {},
              scenes: [],
            };
            title = '导入的白板';
          } else throw new Error('请选择 .excalidraw 或 Local Canvas 文档');
          return store.create('document', parent, title, data);
        },
        backup: () =>
          saveFile(
            store.backup(),
            `local-canvas-backup-${new Date().toISOString().slice(0, 10)}.json`,
          ),
        async restore() {
          const value = await openFile();
          if (value) return store.restore(value);
          return null;
        },
      };
      ipcMain.handle('workspace', async (event, action, args) => {
        trusted(event);
        if (!Object.hasOwn(operations, action) || !Array.isArray(args))
          throw new Error('未知操作');
        return operations[action](...args);
      });
      ipcMain.on('save', (event, id, data, revision) => {
        try {
          trusted(event);
          event.returnValue = { revision: store.save(id, data, revision) };
        } catch (error) {
          event.returnValue = { error: error.message };
        }
      });
      ipcMain.on('save-file', (event, id, data) => {
        try {
          trusted(event);
          payload(data);
          const node = store.node(id),
            link = getLink(id);
          if (link) {
            if (
              !fs.existsSync(link.path) ||
              digest(fs.readFileSync(link.path)) !== link.hash
            )
              throw new Error(
                '原文件已在外部修改或移动。本机副本已保存，请使用“另存为”以免覆盖外部内容。',
              );
            link.hash = writeLinked(link, node.title, data);
            store.setSetting(`documentFile:${id}`, JSON.stringify(link));
          }
          event.returnValue = { linked: !!link };
        } catch (error) {
          event.returnValue = { error: error.message };
        }
      });
      // All editor assets are bundled; the desktop renderer cannot contact cloud services.
      session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
        callback({ cancel: /^https?:|^wss?:/.test(details.url) }),
      );
      session.defaultSession.setPermissionRequestHandler(
        (wc, permission, callback) =>
          callback(permission === 'fullscreen' && wc === win?.webContents),
      );
      function createWindow() {
        win = new BrowserWindow({
          width: 1440,
          height: 940,
          minWidth: 1000,
          minHeight: 650,
          backgroundColor: '#f5f4f1',
          webPreferences: {
            preload: join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.webContents.on('will-navigate', (event) => event.preventDefault());
        win.loadURL(url);
      }
      createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error) => {
      dialog.showErrorBox('无法打开工作区', error.message);
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => store?.close());
}
async function saveFile(value, defaultPath) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath,
  });
  if (canceled) return false;
  const temporary = `${filePath}.${process.pid}.tmp`;
  const fd = fs.openSync(temporary, 'wx');
  try {
    fs.writeFileSync(fd, JSON.stringify(value));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(temporary, filePath);
  } catch (e) {
    fs.unlinkSync(temporary);
    throw e;
  }
  return true;
}
function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function writeLinked(link, title, data) {
  const value = link.native
    ? {
        type: 'excalidraw',
        version: 2,
        source: 'local-canvas',
        elements: data.elements,
        appState: data.appState,
        files: data.files,
        localCanvas: {
          version: 1,
          scenes: data.scenes,
          libraryItems: data.libraryItems || [],
        },
      }
    : { format: 'local-canvas-document', version: 1, title, data };
  const bytes = JSON.stringify(value),
    temporary = `${link.path}.${process.pid}.tmp`;
  const fd = fs.openSync(temporary, 'wx');
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(temporary, link.path);
  } catch (error) {
    fs.unlinkSync(temporary);
    throw error;
  }
  return digest(bytes);
}
async function openFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: '画布与备份', extensions: ['json', 'excalidraw'] }],
  });
  if (canceled) return null;
  if (fs.statSync(filePaths[0]).size > 500 * 1024 * 1024)
    throw new Error('文件超过 500 MB');
  return JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
}
