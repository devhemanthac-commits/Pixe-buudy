// Procedural animation layer on top of the sprite animator.
// Spring-driven CSS transforms on the cat's wrapper element, so it works
// with ANY sprite sheet — including imported custom buddies.
//
//   mochi stretch  → drag: stretches along pull speed, leans into motion
//   release bounce → springy squash when you let go
//   wiggle         → shake detection fires a rotation impulse
//   breathing      → subtle scale sine while idle (slow + deeper in sleep)
//   cursor tilt    → head leans toward your cursor, like it's watching
//   walking        → the cat actually travels across its window

function makeSpring(value) {
  return { v: value, vel: 0 }
}

function stepSpring(s, target, stiffness, damping, dt) {
  s.vel += (target - s.v) * stiffness * dt
  s.vel *= Math.exp(-damping * dt)
  s.v += s.vel * dt
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export class CatPhysics {
  constructor(wrapEl, { onMoved } = {}) {
    this.wrap = wrapEl
    this.onMoved = onMoved || null

    this.sx = makeSpring(1)
    this.sy = makeSpring(1)
    this.rot = makeSpring(0)
    this.tx = 1 // scale targets
    this.ty = 1
    this.trot = 0

    this.breathing = 'idle' // 'idle' | 'sleep' | null
    this.t = 0

    this.x = null // left px within the stage; null until placed
    this.walk = null // { target, speed }
    this._movedAccum = 0
  }

  // ── placement ───────────────────────────────────────────────────────────
  place(x) {
    this.x = x
    this.wrap.style.left = `${Math.round(x)}px`
  }

  ensureInBounds(stageW) {
    const w = this.wrap.offsetWidth || 64
    if (this.x == null) this.place(stageW - w - 12) // bottom-right default
    else this.place(clamp(this.x, 8, Math.max(8, stageW - w - 8)))
  }

  // ── walking ─────────────────────────────────────────────────────────────
  startWalk(stageW, speed = 28) {
    const w = this.wrap.offsetWidth || 64
    const target = 8 + Math.random() * Math.max(1, stageW - w - 16)
    this.walk = { target, speed }
    return target < (this.x ?? 0) ? -1 : 1 // direction for sprite flip
  }

  stopWalk() {
    this.walk = null
  }

  // ── drag mochi ──────────────────────────────────────────────────────────
  // dx/dy: cursor movement since last event while held
  setDragPull(dx, dy) {
    const speed = Math.hypot(dx, dy)
    const stretch = clamp(speed * 0.010, 0, 0.35)
    this.ty = 1 + stretch
    this.tx = 1 / this.ty // preserve volume — the mochi feel
    this.trot = clamp(dx * 0.45, -12, 12) // lean into the motion
  }

  release() {
    this.tx = 1
    this.ty = 1
    this.trot = 0
    this.sy.vel -= 2.6 // squash impulse → springy landing bounce
  }

  // ── wiggle (shake response) ─────────────────────────────────────────────
  impulseWiggle() {
    this.rot.vel += this.rot.vel >= 0 ? 55 : -55
  }

  // ── cursor watching ─────────────────────────────────────────────────────
  setTilt(deg) {
    this.trot = clamp(deg, -8, 8)
  }

  setBreathing(mode) {
    this.breathing = mode
  }

  // ── integration ─────────────────────────────────────────────────────────
  tick(dt) {
    this.t += dt

    if (this.walk && this.x != null) {
      const dir = Math.sign(this.walk.target - this.x)
      const step = this.walk.speed * dt
      if (Math.abs(this.walk.target - this.x) <= step) {
        this.x = this.walk.target
        this.walk = null
      } else {
        this.x += dir * step
      }
      this.wrap.style.left = `${Math.round(this.x)}px`
      this._movedAccum += dt
      if (this._movedAccum > 0.12 && this.onMoved) {
        this._movedAccum = 0
        this.onMoved()
      }
    }

    let breathe = 0
    if (this.breathing === 'idle') breathe = Math.sin(this.t * 2.6) * 0.012
    else if (this.breathing === 'sleep') breathe = Math.sin(this.t * 1.4) * 0.03

    stepSpring(this.sx, this.tx, 160, 12, dt)
    stepSpring(this.sy, this.ty + breathe, 160, 12, dt)
    stepSpring(this.rot, this.trot, 140, 10, dt)

    this.wrap.style.transform =
      `rotate(${this.rot.v.toFixed(2)}deg) scale(${this.sx.v.toFixed(3)},${this.sy.v.toFixed(3)})`
  }

  walking() {
    return this.walk != null
  }

  destroy() {
    this.wrap.style.transform = ''
  }
}
