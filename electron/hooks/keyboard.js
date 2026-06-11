// Rolling 3-second keypress rate tracker
// Returns keys/sec: 0-3 = idle, 3-8 = knead, 8+ = overheat

const WINDOW_MS = 3000

const times = []

function recordKeypress() {
  const now = Date.now()
  times.push(now)
  const cutoff = now - WINDOW_MS
  while (times.length && times[0] < cutoff) times.shift()
  return times.length / (WINDOW_MS / 1000)
}

module.exports = { recordKeypress }
