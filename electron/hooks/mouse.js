// Global mouse velocity tracking, fed by uiohook events in main.js.
//
// Velocity is averaged over the IPC send window rather than computed
// per-event: per-event deltas need a dt floor to avoid divide-by-zero,
// and that floor under-reports velocity by up to 8x on high-polling-rate
// (1000Hz+) mice. Accumulating distance and dividing by real elapsed
// time is rate-independent.

let last = null
let accumDist = 0
let windowStart = null

// Call on every raw mouse event
function addSample(x, y) {
  const now = Date.now()
  if (!last) {
    last = { x, y }
    windowStart = now
    return
  }
  accumDist += Math.hypot(x - last.x, y - last.y)
  last = { x, y }
  if (windowStart == null) windowStart = now
}

// Call at IPC send time: returns average px/s since the last flush
function flushVelocity() {
  const now = Date.now()
  if (windowStart == null) return 0
  const elapsed = Math.max(1, now - windowStart)
  const velocity = (accumDist / elapsed) * 1000
  accumDist = 0
  windowStart = now
  return velocity
}

module.exports = { addSample, flushVelocity }
