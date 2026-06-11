// XP and level-up system. Persisted to electron-store between sessions.
// Levels are granted by interacting with the cat — petting, dragging,
// typing furiously, coming back after a break, dancing, etc.

export const LEVEL_THRESHOLDS = [0, 50, 150, 350, 700, 1200, 2000, 3200]

const XP_GAIN = {
  pet:      2,   // slow hover → purring
  drag:     1,   // pick up and place
  overheat: 3,   // furious typing
  wake:     5,   // coming back after a break
  dance:    2,   // idle dance animation
  knead:    1,   // steady typing
}

export function getLevelFromXp(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i
  }
  return 0
}

export function xpToNext(xp) {
  const lv = getLevelFromXp(xp)
  const next = LEVEL_THRESHOLDS[lv + 1]
  return next != null ? next - xp : null
}

export class XpSystem {
  constructor(onLevelUp) {
    this.xp = 0
    this.level = 0
    this._onLevelUp = onLevelUp || null
  }

  async load() {
    if (!window.electronAPI) return
    try {
      const v = await window.electronAPI.getStore('xp', 0)
      this.xp = typeof v === 'number' && v >= 0 ? Math.round(v) : 0
      this.level = getLevelFromXp(this.xp)
    } catch {}
  }

  award(event) {
    const gain = XP_GAIN[event] ?? 0
    if (!gain) return
    const prevLv = this.level
    this.xp += gain
    this.level = getLevelFromXp(this.xp)
    window.electronAPI?.setStore('xp', this.xp)
    if (this.level > prevLv && this._onLevelUp) {
      this._onLevelUp(this.level)
    }
  }

  label() {
    return this.level > 0 ? `Lv.${this.level}` : ''
  }

  summary() {
    const remaining = xpToNext(this.xp)
    const base = `Level ${this.level} · ${this.xp} XP`
    return remaining != null ? `${base} · ${remaining} to next` : `${base} · MAX`
  }
}
