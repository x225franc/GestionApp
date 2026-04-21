import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('db', {
    get: (key) => ipcRenderer.invoke('get-data', key),
    save: (key, data) => ipcRenderer.invoke('save-data', { key, data })
});