// Sprite sheet definitions
// Each state maps to an array of frame crops { x, y, w, h }
// Coordinates are in sprite-sheet pixels.
// Default values assume a 192×128 sheet with 32×32 frames arranged in rows.
// Replace with your actual sheet layout after importing your sprite PNG.

const FRAME_W = 32
const FRAME_H = 32

function row(rowIndex, count) {
  return Array.from({ length: count }, (_, i) => ({
    x: i * FRAME_W,
    y: rowIndex * FRAME_H,
    w: FRAME_W,
    h: FRAME_H,
  }))
}

export const SPRITES = {
  idle:     row(0, 4),
  walk:     row(1, 6),
  knead:    row(2, 4),
  overheat: row(3, 4),
  sleep:    row(4, 3),
  wake:     row(5, 5),
  pet:      row(6, 3),
  hunt:     row(7, 4),
  drag:     row(8, 3),
  scroll:   row(9, 3),
  yawn:     row(10, 5),
}

// Frame durations in ms per frame for each state
export const FRAME_DURATION = {
  idle:     200,
  walk:     100,
  knead:    150,
  overheat: 80,
  sleep:    400,
  wake:     120,
  pet:      200,
  hunt:     80,
  drag:     100,
  scroll:   100,
  yawn:     150,
}
