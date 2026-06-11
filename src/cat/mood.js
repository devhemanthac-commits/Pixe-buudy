// Mood state machine.
// External signals set/clear flags; the machine resolves the highest-priority
// active flag. Priority (descending):
//   DRAG > PET > OVERHEAT > HUNT > KNEAD > SCROLL > WALK > IDLE > SLEEP

export const STATES = {
  DRAG:     'drag',
  PET:      'pet',
  OVERHEAT: 'overheat',
  HUNT:     'hunt',
  KNEAD:    'knead',
  SCROLL:   'scroll',
  WALK:     'walk',
  IDLE:     'idle',
  SLEEP:    'sleep',
  WAKE:     'wake',
  YAWN:     'yawn',
}

const PRIORITY = [
  STATES.DRAG,
  STATES.PET,
  STATES.OVERHEAT,
  STATES.HUNT,
  STATES.KNEAD,
  STATES.SCROLL,
  STATES.WALK,
  STATES.IDLE,
  STATES.SLEEP,
]

export class MoodStateMachine {
  constructor() {
    this.current = STATES.IDLE
    this.activeFlags = new Set()
    this._onChange = null
    this._tempTimers = new Map() // flag → timeout id
    this._walkTimer = null
    this._destroyed = false
    this._scheduleWalk()
  }

  onStateChange(cb) {
    this._onChange = cb
  }

  has(flag) {
    return this.activeFlags.has(flag)
  }

  set(flag) {
    if (this._destroyed || !PRIORITY.includes(flag)) return
    this.activeFlags.add(flag)
    this._resolve()
  }

  clear(flag) {
    if (this._destroyed) return
    const timer = this._tempTimers.get(flag)
    if (timer) {
      clearTimeout(timer)
      this._tempTimers.delete(flag)
    }
    if (this.activeFlags.delete(flag)) this._resolve()
  }

  // Set a flag that auto-clears after ms. Re-setting extends the window.
  setTemporary(flag, ms) {
    if (this._destroyed || !PRIORITY.includes(flag)) return
    this.set(flag)
    const existing = this._tempTimers.get(flag)
    if (existing) clearTimeout(existing)
    this._tempTimers.set(
      flag,
      setTimeout(() => {
        this._tempTimers.delete(flag)
        this.clear(flag)
      }, ms)
    )
  }

  _resolve() {
    let next = STATES.IDLE
    for (const state of PRIORITY) {
      if (this.activeFlags.has(state)) {
        next = state
        break
      }
    }
    if (next !== this.current) {
      this.current = next
      if (this._onChange) this._onChange(next)
    }
  }

  // Random wander: every 30-60s, if idle, walk for 3-7s
  _scheduleWalk() {
    if (this._destroyed) return
    const delay = 30000 + Math.random() * 30000
    this._walkTimer = setTimeout(() => {
      if (this.current === STATES.IDLE) {
        this.setTemporary(STATES.WALK, 3000 + Math.random() * 4000)
      }
      this._scheduleWalk()
    }, delay)
  }

  destroy() {
    this._destroyed = true
    if (this._walkTimer) clearTimeout(this._walkTimer)
    for (const timer of this._tempTimers.values()) clearTimeout(timer)
    this._tempTimers.clear()
    this._onChange = null
  }
}
