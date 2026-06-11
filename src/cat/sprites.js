// Sprite sheet definitions.
// One row per state, frames left-to-right. Default layout is 32×32 frames.
// Custom sheets can use any frame size — buildSpriteMap() adapts: rows the
// sheet doesn't have fall back to the idle row, and frame counts are capped
// to what actually fits in the sheet width.

export const DEFAULT_FRAME_W = 32
export const DEFAULT_FRAME_H = 32

// [state, frameCount, frameDurationMs] — row order is the sheet contract
export const STATE_ROWS = [
  ['idle',     4, 200],
  ['walk',     6, 100],
  ['knead',    4, 150],
  ['overheat', 4, 80],
  ['sleep',    3, 400],
  ['wake',     5, 120],
  ['pet',      3, 200],
  ['hunt',     4, 80],
  ['drag',     3, 100],
  ['scroll',   3, 100],
  ['yawn',     5, 150],
  ['stretch',  6, 140],
  ['sit',      4, 250],
  ['dance',    6, 110],
  ['play',     5, 100],
]

export function buildSpriteMap({
  frameW = DEFAULT_FRAME_W,
  frameH = DEFAULT_FRAME_H,
  sheetW = null,
  sheetH = null,
} = {}) {
  const colsAvail = sheetW ? Math.max(1, Math.floor(sheetW / frameW)) : Infinity
  const rowsAvail = sheetH ? Math.max(1, Math.floor(sheetH / frameH)) : Infinity

  const sprites = {}
  const durations = {}

  STATE_ROWS.forEach(([name, count, duration], rowIndex) => {
    // Sheets with fewer rows reuse the idle row so every state still renders
    const row = rowIndex < rowsAvail ? rowIndex : 0
    const n = Math.max(1, Math.min(count, colsAvail))
    sprites[name] = Array.from({ length: n }, (_, i) => ({
      x: i * frameW,
      y: row * frameH,
      w: frameW,
      h: frameH,
    }))
    durations[name] = duration
  })

  return { sprites, durations }
}
