// Rolling 3-second keypress rate tracker (keys/sec)
// 0-3 = idle, 3-8 = kneading, 8+ = overheat

const WINDOW_MS = 3000

const times = []

function prune(now) {
  const cutoff = now - WINDOW_MS
  while (times.length && times[0] < cutoff) times.shift()
}

function recordKeypress() {
  const now = Date.now()
  times.push(now)
  prune(now)
}

// Prunes on read so the rate decays to 0 when typing stops —
// main.js polls this on an interval rather than only on keydown.
function currentRate() {
  prune(Date.now())
  return times.length / (WINDOW_MS / 1000)
}

module.exports = { recordKeypress, currentRate }
