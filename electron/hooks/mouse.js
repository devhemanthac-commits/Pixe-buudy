// Global mouse tracking — velocity, position, button state
// Called from main.js after uiohook starts

let lastX = 0
let lastY = 0
let lastTime = Date.now()

function computeVelocity(x, y) {
  const now = Date.now()
  const dt = Math.max(1, now - lastTime)
  const dx = x - lastX
  const dy = y - lastY
  const velocity = Math.sqrt(dx * dx + dy * dy) / dt * 1000

  lastX = x
  lastY = y
  lastTime = now

  return velocity
}

module.exports = { computeVelocity }
