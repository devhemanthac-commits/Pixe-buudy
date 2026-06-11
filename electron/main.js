const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron')
const path = require('path')
const Store = require('electron-store')

const store = new Store()
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1'

let mainWindow = null
let settingsWindow = null

// Cat bounding box in window-local coords, updated by renderer via IPC
let catBounds = { x: 0, y: 0, width: 128, height: 128 }

function createMainWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  const winWidth = 256
  const winHeight = 256

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    // Position bottom-right on first launch, or restore last position
    x: store.get('windowX', screenW - winWidth - 20),
    y: store.get('windowY', screenH - winHeight - 20),
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Float above fullscreen apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  // Clicks pass through by default; hit-test loop enables them when cursor is on cat
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  startHitTestLoop()
  startInputHooks()

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition()
    store.set('windowX', x)
    store.set('windowY', y)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── Hit-test loop ───────────────────────────────────────────────────────────
// Every ~16ms check whether the cursor is over the cat's canvas bounds.
// If yes, re-enable mouse events so the renderer can catch clicks/hover.
// If no, pass clicks through to apps underneath.
let hitTestInterval = null
let mouseEventsEnabled = false

function startHitTestLoop() {
  hitTestInterval = setInterval(() => {
    if (!mainWindow) return

    const cursor = screen.getCursorScreenPoint()
    const [winX, winY] = mainWindow.getPosition()

    const localX = cursor.x - winX
    const localY = cursor.y - winY

    const overCat =
      localX >= catBounds.x &&
      localX <= catBounds.x + catBounds.width &&
      localY >= catBounds.y &&
      localY <= catBounds.y + catBounds.height

    if (overCat && !mouseEventsEnabled) {
      mainWindow.setIgnoreMouseEvents(false)
      mouseEventsEnabled = true
    } else if (!overCat && mouseEventsEnabled) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true })
      mouseEventsEnabled = false
    }
  }, 16)
}

// ─── Global input hooks ──────────────────────────────────────────────────────
function startInputHooks() {
  try {
    const { UiohookKey, uIOhook } = require('uiohook-napi')

    let lastMouseX = 0
    let lastMouseY = 0
    let lastMouseTime = Date.now()
    const keypressTimes = []

    uIOhook.on('mousemove', (e) => {
      const now = Date.now()
      const dt = Math.max(1, now - lastMouseTime)
      const dx = e.x - lastMouseX
      const dy = e.y - lastMouseY
      const velocity = Math.sqrt(dx * dx + dy * dy) / dt * 1000

      lastMouseX = e.x
      lastMouseY = e.y
      lastMouseTime = now

      if (mainWindow) {
        mainWindow.webContents.send('mouse-move', { x: e.x, y: e.y, velocity })
      }
    })

    uIOhook.on('mousedown', (e) => {
      if (mainWindow) mainWindow.webContents.send('mouse-down', { button: e.button })
    })

    uIOhook.on('mouseup', (e) => {
      if (mainWindow) mainWindow.webContents.send('mouse-up', { button: e.button })
    })

    uIOhook.on('scroll', (e) => {
      if (mainWindow) mainWindow.webContents.send('scroll', { rotation: e.rotation })
    })

    uIOhook.on('keydown', () => {
      const now = Date.now()
      keypressTimes.push(now)
      // Keep only the last 3 seconds
      const cutoff = now - 3000
      while (keypressTimes.length && keypressTimes[0] < cutoff) keypressTimes.shift()

      const rate = keypressTimes.length / 3

      if (mainWindow) {
        mainWindow.webContents.send('keypress-rate', { rate })
      }
    })

    uIOhook.start()
    console.log('[pixe-buudy] uiohook started')
  } catch (err) {
    console.warn('[pixe-buudy] uiohook-napi not available, running without global hooks:', err.message)
  }
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

// Renderer reports the cat's bounding box so hit-test loop knows where to check
ipcMain.on('cat-bounds', (_event, bounds) => {
  catBounds = bounds
})

// Drag: renderer tells main to start window drag
ipcMain.on('start-drag', () => {
  if (mainWindow) mainWindow.webContents.send('drag-started')
})

ipcMain.handle('get-store', (_event, key, defaultValue) => {
  return store.get(key, defaultValue)
})

ipcMain.handle('set-store', (_event, key, value) => {
  store.set(key, value)
})

ipcMain.on('open-settings', () => {
  openSettingsWindow()
})

ipcMain.on('quit-app', () => {
  app.quit()
})

// ─── Settings window ─────────────────────────────────────────────────────────
function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Pixe-buudy Settings',
    frame: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/#/settings')
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/settings',
    })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createMainWindow()

  // macOS: re-create window if dock icon is clicked and no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (hitTestInterval) clearInterval(hitTestInterval)
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  try {
    const { uIOhook } = require('uiohook-napi')
    uIOhook.stop()
  } catch {}
})
