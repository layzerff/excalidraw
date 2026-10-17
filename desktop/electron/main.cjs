const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const { Store, payload } = require('./store.cjs');
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
      store = new Store(join(app.getPath('userData'), 'workspace.sqlite'));
      const backupDir = join(app.getPath('userData'), 'backups');
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
        read: (id) => store.read(id),
        create: (...args) => store.create(...args),
        rename: (...args) => store.rename(...args),
        move: (...args) => store.move(...args),
        trash: (...args) => store.trash(...args),
        getSetting: (key) => store.getSetting(key),
        setSetting: (...args) => store.setSetting(...args),
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
      // All editor assets are bundled; the desktop renderer cannot contact cloud services.
      session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
        callback({ cancel: /^https?:|^wss?:/.test(details.url) }),
      );
      session.defaultSession.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false),
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
