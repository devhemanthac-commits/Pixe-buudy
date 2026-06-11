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
  s.scale = clamp(num(s.scale, DEFAULT_SETTINGS.scale), 1, 6)
  s.hue = clamp(num(s.hue, DEFAULT_SETTINGS.hue), 0, 360)
  s.saturate = clamp(num(s.saturate, DEFAULT_SETTINGS.saturate), 0, 200)
  s.brightness = clamp(num(s.brightness, DEFAULT_SETTINGS.brightness), 50, 150)
  s.frameW = clamp(Math.round(num(s.frameW, DEFAULT_SETTINGS.frameW)), 8, 128)
  s.frameH = clamp(Math.round(num(s.frameH, DEFAULT_SETTINGS.frameH)), 8, 128)
  s.name = typeof s.name === 'string' ? s.name.slice(0, 24) : DEFAULT_SETTINGS.name
  s.sound = Boolean(s.sound)
  if (typeof s.customSheet !== 'string' || !s.customSheet.startsWith('data:image/')) {
    s.customSheet = null
  }
  return s
}

// Number(undefined) is NaN and NaN is not nullish, so `Number(x) ?? d`
// leaks NaN — always go through a finite check instead.
function num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
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
