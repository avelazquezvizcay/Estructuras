const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbAll: (sql, params) => ipcRenderer.invoke('db-all', sql, params),
  dbGet: (sql, params) => ipcRenderer.invoke('db-get', sql, params),
  dbRun: (sql, params) => ipcRenderer.invoke('db-run', sql, params),
  dbTransaction: (statements) => ipcRenderer.invoke('db-transaction', statements)
});
