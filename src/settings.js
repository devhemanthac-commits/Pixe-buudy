// Shared between the cat window and the settings window.

export const DEFAULT_SETTINGS = {
  name: 'Buddy',
  scale: 2,          // 1–6, pixel-art multiplier
  hue: 0,            // 0–360 hue rotation
  saturate: 100,     // 0–200 %
  brightness: 100,   // 50–150 %
  customSheet: null, // dataURL of an imported sprite sheet, or null
  frameW: 32,        // frame size of the custom sheet
  frameH: 32,
  sound: true,
}

export const MAX_SHEET_BYTES = 2 * 1024 * 1024 // 2MB cap for imported sheets

export const COLOR_PRESETS = [
  { label: 'Ginger', hue: 0,   saturate: 100 },
  { label: 'Sky',    hue: 200, saturate: 100 },
  { label: 'Sakura', hue: 310, saturate: 100 },
  { label: 'Mint',   hue: 120, saturate: 100 },
  { label: 'Grape',  hue: 260, saturate: 100 },
  { label: 'Ash',    hue: 0,   saturate: 0 },
]

export function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) }
  s.scale = clamp(Number(s.scale) || 2, 1, 6)
  s.hue = clamp(Number(s.hue) || 0, 0, 360)
  s.saturate = clamp(Number(s.saturate) ?? 100, 0, 200)
  s.brightness = clamp(Number(s.brightness) ?? 100, 50, 150)
  s.frameW = clamp(Math.round(Number(s.frameW) || 32), 8, 128)
  s.frameH = clamp(Math.round(Number(s.frameH) || 32), 8, 128)
  if (typeof s.customSheet !== 'string' || !s.customSheet.startsWith('data:image/')) {
    s.customSheet = null
  }
  return s
}

export function buildFilter(s) {
  const parts = []
  if (s.hue % 360 !== 0) parts.push(`hue-rotate(${s.hue}deg)`)
  if (s.saturate !== 100) parts.push(`saturate(${s.saturate}%)`)
  if (s.brightness !== 100) parts.push(`brightness(${s.brightness}%)`)
  return parts.join(' ')
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}
