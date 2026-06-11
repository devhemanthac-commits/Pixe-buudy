const { app, BrowserWindow, ipcMain, screen, powerMonitor } = require('electron')
const path = require('path')
const Store = require('electron-store')

const { computeVelocity } = require('./hooks/mouse')
const { recordKeypress, currentRate } = require('./hooks/keyboard')
const { startAppPolling, stopAppPolling } = require('./hooks/system')

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1'
const DEV_URL = 'http://localhost:5173'

const WIN_W = 256
const WIN_H = 256
const HIT_TEST_MS = 16     // hit-test / drag loop tick
const MOUSE_SEND_MS = 33   // throttle mouse-move IPC to ~30Hz
const RATE_SEND_MS = 250   // keypress rate broadcast interval
const IDLE_CHECK_MS = 5000
const IDLE_SECONDS = 180   // 3 minutes → sleep

const store = new Store()

let mainWindow = null
let settingsWindow = null
let uiohookStarted = false
let mouseEventsEnabled = false

// Cat bounding box in window-local DIPs, reported by the renderer.
// Zero-size until the renderer reports, so clicks pass through during startup.
let catBounds = { x: 0, y: 0, width: 0, height: 0 }

// Active drag: cursor offset inside the window when the grab started
let dragState = null

const intervals = []

// ─── Crash guards ────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[pixe-buudy] uncaught exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[pixe-buudy] unhandled rejection:', reason)
})

// ─── Single instance ─────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  // Transparent windows on Linux need this flag before ready
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-transparent-visuals')
  }

  app.whenReady().then(() => {
    // Give the compositor a beat on Linux before creating a transparent window
    if (process.platform === 'linux') setTimeout(bootstrap, 300)
    else bootstrap()
  })
}

function bootstrap() {
  createMainWindow()
  startHitTestLoop()
  startInputHooks()
  startIdleWatcher()
  startAppPolling((name) => safeSend('active-app', { name }))

  screen.on('display-metrics-changed', ensureOnScreen)
  screen.on('display-removed', ensureOnScreen)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function safeSend(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const wc = mainWindow.webContents
  if (wc.isDestroyed()) return
  try {
    wc.send(channel, payload)
  } catch {}
}

function clampToWorkArea(x, y, w, h) {
  const wa = screen.getDisplayMatching({ x, y, width: w, height: h }).workArea
  const cx = Math.min(Math.max(x, wa.x), wa.x + wa.width - w)
  const cy = Math.min(Math.max(y, wa.y), wa.y + wa.height - h)
  return [Math.round(cx), Math.round(cy)]
}

function ensureOnScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const [x, y] = mainWindow.getPosition()
  const [cx, cy] = clampToWorkArea(x, y, WIN_W, WIN_H)
  if (cx !== x || cy !== y) mainWindow.setPosition(cx, cy)
}

function savePositionNow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const [x, y] = mainWindow.getPosition()
  store.set('windowX', x)
  store.set('windowY', y)
}

// ─── Main window ─────────────────────────────────────────────────────────────
function createMainWindow() {
  const { workArea } = screen.getPrimaryDisplay()
  const defaultX = workArea.x + workArea.width - WIN_W - 20
  const defaultY = workArea.y + workArea.height - WIN_H - 20

  const [startX, startY] = clampToWorkArea(
    store.get('windowX', defaultX),
    store.get('windowY', defaultY),
    WIN_W,
    WIN_H
  )

  mainWindow = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: startX,
    y: startY,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  })

  // Float above fullscreen apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  // Clicks pass through by default; hit-test loop enables them when cursor is on cat
  mainWindow.setIgnoreMouseEvents(true, { forward: true })
  mouseEventsEnabled = false

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Retry in dev if Vite isn't up yet
  mainWindow.webContents.on('did-fail-load', () => {
    if (isDev && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(DEV_URL)
      }, 1000)
    }
  })

  // Renderer crash recovery: reload, but bail out of a crash loop
  const crashTimes = []
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[pixe-buudy] renderer gone:', details.reason)
    const now = Date.now()
    crashTimes.push(now)
    while (crashTimes.length && crashTimes[0] < now - 60000) crashTimes.shift()
    if (crashTimes.length > 3) {
      console.error('[pixe-buudy] renderer crash loop, quitting')
      app.quit()
      return
    }
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload()
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[pixe-buudy] renderer unresponsive')
  })

  // Persist position, debounced so dragging doesn't hammer the disk
  let saveTimer = null
  mainWindow.on('move', () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(savePositionNow, 500)
  })

  mainWindow.on('closed', () => {
    clearTimeout(saveTimer)
    mainWindow = null
  })
}

// ─── Hit-test + drag loop ────────────────────────────────────────────────────
// Every ~16ms: if dragging, move the window with the cursor. Otherwise check
// whether the cursor is over the cat bounds and toggle click-through.
function startHitTestLoop() {
  intervals.push(
    setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return

      let cursor
      try {
        cursor = screen.getCursorScreenPoint()
      } catch {
        return
      }

      if (dragState) {
        mainWindow.setPosition(
          Math.round(cursor.x - dragState.offsetX),
          Math.round(cursor.y - dragState.offsetY)
        )
        if (!mouseEventsEnabled) {
          mainWindow.setIgnoreMouseEvents(false)
          mouseEventsEnabled = true
        }
        return
      }

      const [winX, winY] = mainWindow.getPosition()
      const lx = cursor.x - winX
      const ly = cursor.y - winY
      const b = catBounds
      const over =
        b.width > 0 &&
        lx >= b.x && lx <= b.x + b.width &&
        ly >= b.y && ly <= b.y + b.height

      if (over && !mouseEventsEnabled) {
        mainWindow.setIgnoreMouseEvents(false)
        mouseEventsEnabled = true
      } else if (!over && mouseEventsEnabled) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true })
        mouseEventsEnabled = false
      }
    }, HIT_TEST_MS)
  )
}

function endDrag() {
  if (!dragState) return
  dragState = null
  safeSend('drag-ended')
  ensureOnScreen()
  savePositionNow()
}

// ─── Global input hooks ──────────────────────────────────────────────────────
function startInputHooks() {
  let uIOhook
  try {
    ;({ uIOhook } = require('uiohook-napi'))
  } catch (err) {
    console.warn('[pixe-buudy] uiohook-napi unavailable, no global hooks:', err.message)
    return
  }

  // Mouse movement → throttled IPC with peak velocity over the window
  let lastMouseSend = 0
  let peakVelocity = 0
  const onMove = (e) => {
    const velocity = computeVelocity(e.x, e.y)
    if (velocity > peakVelocity) peakVelocity = velocity
    const now = Date.now()
    if (now - lastMouseSend >= MOUSE_SEND_MS) {
      lastMouseSend = now
      safeSend('mouse-move', { x: e.x, y: e.y, velocity: peakVelocity })
      peakVelocity = 0
    }
  }
  uIOhook.on('mousemove', onMove)
  uIOhook.on('mousedrag', onMove) // button held — separate event in uiohook

  uIOhook.on('mousedown', (e) => safeSend('mouse-down', { button: e.button }))
  uIOhook.on('mouseup', (e) => {
    safeSend('mouse-up', { button: e.button })
    endDrag() // backstop: never leave the window glued to the cursor
  })

  // uiohook-napi emits 'wheel' for scroll
  const onWheel = (e) => safeSend('scroll', { rotation: e.rotation })
  uIOhook.on('wheel', onWheel)
  uIOhook.on('scroll', onWheel)

  uIOhook.on('keydown', () => {
    recordKeypress()
  })

  // Broadcast rate on an interval so it decays to 0 when typing stops
  let lastSentRate = -1
  intervals.push(
    setInterval(() => {
      const rate = currentRate()
      if (Math.abs(rate - lastSentRate) > 0.05) {
        lastSentRate = rate
        safeSend('keypress-rate', { rate })
      }
    }, RATE_SEND_MS)
  )

  try {
    uIOhook.start()
    uiohookStarted = true
    console.log('[pixe-buudy] uiohook started')
  } catch (err) {
    console.warn('[pixe-buudy] uiohook failed to start:', err.message)
  }
}

// ─── Idle watcher (system-level, survives renderer reloads) ──────────────────
function startIdleWatcher() {
  let wasIdle = false
  intervals.push(
    setInterval(() => {
      const idle = powerMonitor.getSystemIdleTime() >= IDLE_SECONDS
      if (idle !== wasIdle) {
        wasIdle = idle
        safeSend('idle-change', { idle })
      }
    }, IDLE_CHECK_MS)
  )
}

// ─── IPC handlers ────────────────────────────────────────────────────────────
ipcMain.on('cat-bounds', (_event, b) => {
  if (!b || typeof b !== 'object') return
  const { x, y, width, height } = b
  if (![x, y, width, height].every(Number.isFinite)) return
  catBounds = { x, y, width: Math.max(0, width), height: Math.max(0, height) }
})

ipcMain.on('drag-start', (_event, o) => {
  if (!o || !Number.isFinite(o.offsetX) || !Number.isFinite(o.offsetY)) return
  dragState = { offsetX: o.offsetX, offsetY: o.offsetY }
})

ipcMain.on('drag-end', () => endDrag())

ipcMain.handle('get-store', (_event, key, defaultValue) => {
  if (typeof key !== 'string') return undefined
  return store.get(key, defaultValue)
})

ipcMain.handle('set-store', (_event, key, value) => {
  if (typeof key !== 'string') return
  store.set(key, value)
})

ipcMain.on('open-settings', () => openSettingsWindow())

ipcMain.on('quit-app', () => app.quit())

// ─── Settings window ─────────────────────────────────────────────────────────
function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Pixe-buudy Settings',
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    settingsWindow.loadURL(`${DEV_URL}/#/settings`)
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/settings' })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  intervals.forEach(clearInterval)
  intervals.length = 0
  stopAppPolling()
  if (uiohookStarted) {
    try {
      require('uiohook-napi').uIOhook.stop()
    } catch {}
  }
})
