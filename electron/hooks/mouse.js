// Global mouse velocity tracking (px/sec), fed by uiohook events in main.js

let last = null

function computeVelocity(x, y) {
  const now = Date.now()
  if (!last) {
    last = { x, y, t: now }
    return 0
  }
  // Floor dt so sub-ms event bursts don't produce absurd spikes
  const dt = Math.max(8, now - last.t)
  const v = (Math.hypot(x - last.x, y - last.y) / dt) * 1000
  last = { x, y, t: now }
  return v
}

function reset() {
  last = null
}

module.exports = { computeVelocity, reset }
