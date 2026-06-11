const { contextBridge, ipcRenderer } = require('electron')

// Each on* helper returns an unsubscribe function so the renderer can
// clean up precisely instead of nuking whole channels.
function subscribe(channel) {
  return (cb) => {
    const handler = (_event, data) => cb(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer → Main
  setCatBounds: (bounds) => ipcRenderer.send('cat-bounds', bounds),
  dragStart: (offset) => ipcRenderer.send('drag-start', offset),
  dragEnd: () => ipcRenderer.send('drag-end'),
  openSettings: () => ipcRenderer.send('open-settings'),
  quitApp: () => ipcRenderer.send('quit-app'),
  updateSettings: (settings) => ipcRenderer.send('settings-updated', settings),

  // Main → Renderer
  onMouseMove: subscribe('mouse-move'),
  onMouseDown: subscribe('mouse-down'),
  onMouseUp: subscribe('mouse-up'),
  onScroll: subscribe('scroll'),
  onKeypressRate: subscribe('keypress-rate'),
  onIdleChange: subscribe('idle-change'),
  onActiveApp: subscribe('active-app'),
  onDragEnded: subscribe('drag-ended'),
  onSettingsChanged: subscribe('settings-changed'),

  // Persistent store
  getStore: (key, defaultValue) => ipcRenderer.invoke('get-store', key, defaultValue),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),
})
