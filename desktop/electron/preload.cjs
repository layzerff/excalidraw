const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('workspace', {
  invoke: (action, ...args) => ipcRenderer.invoke('workspace', action, args),
  save: (id, data, revision) => {
    const result = ipcRenderer.sendSync('save', id, data, revision);
    if (result.error) throw new Error(result.error);
    return result.revision;
  },
});
