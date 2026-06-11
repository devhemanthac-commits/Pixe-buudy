// Active app polling via active-win (ESM-only package — dynamic import).
// Idle detection lives in main.js via powerMonitor, which is more reliable
// than tracking input timestamps ourselves.

let pollInterval = null
let lastApp = null

async function startAppPolling(onAppChange, intervalMs = 2000) {
  try {
    const mod = await import('active-win')
    const getActiveWin = mod.default || mod.activeWindow || mod.activeWin
    if (typeof getActiveWin !== 'function') throw new Error('unexpected active-win export shape')

    pollInterval = setInterval(async () => {
      try {
        const win = await getActiveWin()
        const name = win?.owner?.name || 'unknown'
        if (name !== lastApp) {
          lastApp = name
          onAppChange(name)
        }
      } catch {
        // Permission denied (macOS screen recording) or transient failure — skip tick
      }
    }, intervalMs)
  } catch (err) {
    console.warn('[pixe-buudy] active-win unavailable, app awareness disabled:', err.message)
  }
}

function stopAppPolling() {
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = null
  lastApp = null
}

module.exports = { startAppPolling, stopAppPolling }
