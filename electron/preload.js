const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Database
  dbAll: (sql, params) => ipcRenderer.invoke('db-all', sql, params),
  dbGet: (sql, params) => ipcRenderer.invoke('db-get', sql, params),
  dbRun: (sql, params) => ipcRenderer.invoke('db-run', sql, params),
  dbTransaction: (statements) => ipcRenderer.invoke('db-transaction', statements),

  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-status');
  }
});
