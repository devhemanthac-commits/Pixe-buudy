// System-level signals: idle detection, active app polling
// active-win is an ESM-only package — we dynamic-import it

const IDLE_THRESHOLD_MS = 3 * 60 * 1000  // 3 minutes

let lastInputTime = Date.now()
let activeWin = null
let appPollInterval = null

function recordInput() {
  lastInputTime = Date.now()
}

function isIdle() {
  return Date.now() - lastInputTime > IDLE_THRESHOLD_MS
}

function getIdleMs() {
  return Date.now() - lastInputTime
}

async function startAppPolling(onAppChange) {
  // active-win is ESM, needs dynamic import
  try {
    const mod = await import('active-win')
    const getActiveWin = mod.default || mod.activeWin

    appPollInterval = setInterval(async () => {
      try {
        const win = await getActiveWin()
        const appName = win?.owner?.name || 'unknown'
        if (appName !== activeWin) {
          activeWin = appName
          onAppChange(appName)
        }
      } catch {}
    }, 2000)
  } catch (err) {
    console.warn('[pixe-buudy] active-win not available:', err.message)
  }
}

function stopAppPolling() {
  if (appPollInterval) clearInterval(appPollInterval)
}

module.exports = { recordInput, isIdle, getIdleMs, startAppPolling, stopAppPolling }
