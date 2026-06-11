// Mood state machine
// Priority (descending): DRAG > PET > OVERHEAT > HUNT > KNEAD > SCROLL > WALK > IDLE > SLEEP

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
    this._walkTimer = null
    this._idleTimer = null
    this._startWalkCycle()
  }

  onStateChange(cb) {
    this._onChange = cb
  }

  // External signals set/clear flags; machine resolves the highest-priority active one
  set(flag) {
    if (!PRIORITY.includes(flag)) return
    this.activeFlags.add(flag)
    this._resolve()
  }

  clear(flag) {
    this.activeFlags.delete(flag)
    this._resolve()
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

  // Randomly enter WALK state every 30–60s while idle
  _startWalkCycle() {
    const schedule = () => {
      const delay = 30000 + Math.random() * 30000
      this._walkTimer = setTimeout(() => {
        if (this.current === STATES.IDLE) {
          this.set(STATES.WALK)
          setTimeout(() => {
            this.clear(STATES.WALK)
            schedule()
          }, 3000 + Math.random() * 4000)
        } else {
          schedule()
        }
      }, delay)
    }
    schedule()
  }

  destroy() {
    if (this._walkTimer) clearTimeout(this._walkTimer)
    if (this._idleTimer) clearTimeout(this._idleTimer)
  }
}
