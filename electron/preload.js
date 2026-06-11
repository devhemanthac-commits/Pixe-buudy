const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer → Main
  setCatBounds: (bounds) => ipcRenderer.send('cat-bounds', bounds),
  startDrag: () => ipcRenderer.send('start-drag'),
  openSettings: () => ipcRenderer.send('open-settings'),
  quitApp: () => ipcRenderer.send('quit-app'),

  // Main → Renderer (subscribe)
  onMouseMove: (cb) => ipcRenderer.on('mouse-move', (_e, data) => cb(data)),
  onMouseDown: (cb) => ipcRenderer.on('mouse-down', (_e, data) => cb(data)),
  onMouseUp: (cb) => ipcRenderer.on('mouse-up', (_e, data) => cb(data)),
  onScroll: (cb) => ipcRenderer.on('scroll', (_e, data) => cb(data)),
  onKeypressRate: (cb) => ipcRenderer.on('keypress-rate', (_e, data) => cb(data)),

  // Persistent store
  getStore: (key, defaultValue) => ipcRenderer.invoke('get-store', key, defaultValue),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),

  // Cleanup helper
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
})
