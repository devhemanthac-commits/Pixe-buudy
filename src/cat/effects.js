// Pixel-art particle engine, drawn on a window-sized overlay canvas
// (pointer-events: none — never interferes with the hit-test loop).
//
//   steam   → overheat: grey puffs rising off the head
//   zzz     → sleep: little Z's drifting up and right
//   heart   → petting: pink hearts floating up with a sway
//   sparkle → dancing: gold twinkles popping around the body

const PIXEL = 2 // particle pixel size — chunky to match the cat

const PATTERNS = {
  heart: [
    '.XX.XX.',
    'XXXXXXX',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
    '...X...',
  ],
  zzz: [
    'XXXX',
    '...X',
    '..X.',
    '.X..',
    'XXXX',
  ],
  sparkle: [
    '..X..',
    '..X..',
    'XXXXX',
    '..X..',
    '..X..',
  ],
}

const COLORS = {
  heart: '#ff6b9d',
  zzz: '#9aa7ff',
  sparkle: '#ffe066',
  steam: '200,200,212', // rgb, alpha applied per-particle
}

export class Effects {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.particles = []
    this.resize()
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  // x/y in window coords (stage is inset:0, so client coords work directly)
  spawn(type, x, y) {
    if (this.particles.length > 60) return // hard cap, never let it run away
    const jitter = (n) => (Math.random() - 0.5) * n
    const base = {
      type,
      x: x + jitter(14),
      y,
      age: 0,
      phase: Math.random() * Math.PI * 2,
    }
    switch (type) {
      case 'steam':
        this.particles.push({ ...base, vx: jitter(6), vy: -28, life: 1.4, r: 3 + Math.random() * 3 })
        break
      case 'zzz':
        this.particles.push({ ...base, vx: 9 + jitter(4), vy: -16, life: 2.4 })
        break
      case 'heart':
        this.particles.push({ ...base, vx: jitter(8), vy: -24, life: 1.6 })
        break
      case 'sparkle':
        this.particles.push({ ...base, x: x + jitter(40), y: y + jitter(30), vx: 0, vy: -4, life: 0.7 })
        break
    }
  }

  tick(dt) {
    const ps = this.particles
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.age += dt
      if (p.age >= p.life) {
        ps.splice(i, 1)
        continue
      }
      p.x += (p.vx + Math.sin(p.phase + p.age * 4) * 6) * dt
      p.y += p.vy * dt
    }
    this._draw()
  }

  _draw() {
    const g = this.ctx
    g.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for (const p of this.particles) {
      const fade = 1 - p.age / p.life
      if (p.type === 'steam') {
        // expanding soft square puff
        const r = p.r + p.age * 7
        g.fillStyle = `rgba(${COLORS.steam},${(0.5 * fade).toFixed(3)})`
        g.fillRect(Math.round(p.x - r), Math.round(p.y - r), Math.round(r * 2), Math.round(r * 2))
        continue
      }
      const pattern = PATTERNS[p.type]
      if (!pattern) continue
      g.globalAlpha = fade
      g.fillStyle = COLORS[p.type]
      const w = pattern[0].length * PIXEL
      for (let row = 0; row < pattern.length; row++) {
        for (let col = 0; col < pattern[row].length; col++) {
          if (pattern[row][col] === 'X') {
            g.fillRect(
              Math.round(p.x - w / 2 + col * PIXEL),
              Math.round(p.y + row * PIXEL),
              PIXEL,
              PIXEL
            )
          }
        }
      }
      g.globalAlpha = 1
    }
  }

  destroy() {
    this.particles.length = 0
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}
