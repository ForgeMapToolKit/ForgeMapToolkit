'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('logBridge', {
  onHistory: (cb) => ipcRenderer.on('log-history', (_, data) => cb(data)),
  onLine:    (cb) => ipcRenderer.on('log-line',    (_, data) => cb(data)),
  requestHistory: () => ipcRenderer.send('log-request-history'),
  getLogFilePath: () => ipcRenderer.invoke('get-log-file-path'),
});