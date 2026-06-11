// Pixel-art particle engine, drawn on a window-sized overlay canvas.
// Never interferes with the hit-test loop — the canvas is pointer-events:none.
//
//   steam   → overheat: 2-puff clusters rising off the head
//   zzz     → sleep: size-cycling Z's drifting up and right
//   heart   → petting: arcing hearts (up then gravity pulls gently down)
//   sparkle → dancing: gold twinkles popping around the body
//   burst   → level-up: 18-particle radial explosion with mixed colours
//
// Text overlays are drawn after particles each frame, positioned in window coords:
//   nameTip    → buddy's name, shown above the cat when being petted
//   levelBadge → "Lv.N" shown near the cat's top-right corner

const PIXEL = 2

const PATTERNS = {
  heart: [
    '.XX.XX.',
    'XXXXXXX',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
    '...X...',
  ],
  // ZZZ: three sizes cycle so they visually grow as if "floating up"
  zzz_s: [
    'XXX',
    '..X',
    '.X.',
    'XXX',
  ],
  zzz_m: [
    'XXXX',
    '...X',
    '..X.',
    '.X..',
    'XXXX',
  ],
  zzz_l: [
    'XXXXX',
    '....X',
    '...X.',
    '..X..',
    '.X...',
    'XXXXX',
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
  heart:   '#ff6b9d',
  zzz:     '#9aa7ff',
  sparkle: '#ffe066',
  steam:   '200,200,212', // rgb only, alpha applied per-particle
}

const BURST_PALETTE = ['#ffe066', '#ff6b9d', '#9aa7ff', '#81ecec', '#a29bfe', '#ffffff']

export class Effects {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.particles = []
    this._zzzSeq = 0  // increments to cycle small/medium/large Z
    this._overlay = null
    this.resize()
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  // Call each rAF frame; data = { nameTip, levelBadge } — either can be null
  setOverlay(data) {
    this._overlay = data
  }

  // x/y in window coords (stage is inset:0, so client coords work directly)
  spawn(type, x, y) {
    if (this.particles.length >= 100) return
    const jitter = (n) => (Math.random() - 0.5) * n
    const base = { age: 0, phase: Math.random() * Math.PI * 2 }

    switch (type) {
      case 'steam':
        // 2-puff cluster: slightly staggered in space for a more organic look
        for (let i = 0; i < 2; i++) {
          this.particles.push({
            ...base, type,
            x: x + jitter(20),
            y: y + jitter(6),
            vx: jitter(8),
            vy: -(16 + Math.random() * 14),
            life: 1.0 + Math.random() * 0.5,
            r: 2.5 + Math.random() * 3,
          })
        }
        break

      case 'zzz': {
        const sizes = ['s', 'm', 'l']
        const sz = sizes[this._zzzSeq % 3]
        this._zzzSeq++
        this.particles.push({ ...base, type, x: x + jitter(8), y, vx: 10 + jitter(3), vy: -16, life: 2.2, sz })
        break
      }

      case 'heart':
        // Gravity arc: launches fast upward, then slows and gently falls
        this.particles.push({
          ...base, type,
          x: x + jitter(14),
          y,
          vx: jitter(10),
          vy: -54,
          gravity: 28,
          life: 1.9,
        })
        break

      case 'sparkle':
        this.particles.push({
          ...base, type,
          x: x + jitter(40), y: y + jitter(30),
          vx: 0, vy: -4, life: 0.7,
        })
        break
    }
  }

  // Radial burst for level-up — 18 pixels flying out from (x, y)
  burst(x, y) {
    const COUNT = 18
    for (let i = 0; i < COUNT; i++) {
      if (this.particles.length >= 120) break
      const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.3
      const speed = 55 + Math.random() * 65
      this.particles.push({
        type: 'burst',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0, phase: 0,
        life: 0.65 + Math.random() * 0.35,
        color: BURST_PALETTE[i % BURST_PALETTE.length],
      })
    }
  }

  tick(dt) {
    const ps = this.particles
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.age += dt
      if (p.age >= p.life) { ps.splice(i, 1); continue }

      const sway = Math.sin(p.phase + p.age * 4) * 6
      p.x += (p.vx + (p.type === 'steam' ? sway * 0.4 : sway)) * dt
      if (p.gravity) p.vy += p.gravity * dt
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
        const r = p.r + p.age * 6
        g.fillStyle = `rgba(${COLORS.steam},${(0.45 * fade).toFixed(3)})`
        g.fillRect(Math.round(p.x - r), Math.round(p.y - r), Math.round(r * 2), Math.round(r * 2))
        continue
      }

      if (p.type === 'burst') {
        const sz = Math.round(PIXEL * (1.5 + fade))
        g.globalAlpha = fade * fade
        g.fillStyle = p.color
        g.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz)
        g.globalAlpha = 1
        continue
      }

      // Pattern-based (heart / zzz / sparkle)
      const pattern =
        p.type === 'zzz' ? PATTERNS[`zzz_${p.sz || 'm'}`]
        : PATTERNS[p.type]
      if (!pattern) continue

      g.globalAlpha = fade
      g.fillStyle =
        p.type === 'zzz'   ? COLORS.zzz
        : p.type === 'heart' ? COLORS.heart
        : COLORS.sparkle

      const w = pattern[0].length * PIXEL
      for (let row = 0; row < pattern.length; row++) {
        for (let col = 0; col < pattern[row].length; col++) {
          if (pattern[row][col] === 'X') {
            g.fillRect(
              Math.round(p.x - w / 2 + col * PIXEL),
              Math.round(p.y + row * PIXEL),
              PIXEL, PIXEL
            )
          }
        }
      }
      g.globalAlpha = 1
    }

    this._drawOverlay()
  }

  _drawOverlay() {
    const ov = this._overlay
    if (!ov) return
    const g = this.ctx

    if (ov.nameTip?.visible) {
      const { text, x, y, alpha } = ov.nameTip
      g.globalAlpha = alpha
      g.textBaseline = 'bottom'
      g.textAlign = 'center'
      g.font = 'bold 11px "Courier New", monospace'
      const tw = g.measureText(text).width
      const pad = 6
      const bx = Math.round(x - tw / 2 - pad)
      const by = Math.round(y - 15)
      const bw = Math.round(tw + pad * 2)
      const bh = 16
      g.fillStyle = 'rgba(0,0,0,0.58)'
      _roundRect(g, bx, by, bw, bh, 4)
      g.fill()
      g.fillStyle = '#ffffff'
      g.fillText(text, x, y)
      g.globalAlpha = 1
      g.textAlign = 'left'
    }

    if (ov.levelBadge?.visible) {
      const { text, x, y } = ov.levelBadge
      g.globalAlpha = 0.88
      g.textBaseline = 'top'
      g.textAlign = 'right'
      g.font = 'bold 8px monospace'
      g.fillStyle = '#ffe066'
      g.fillText(text, x, y)
      g.globalAlpha = 1
      g.textAlign = 'left'
    }
  }

  destroy() {
    this.particles.length = 0
    this._overlay = null
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}

function _roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.lineTo(x + w - r, y)
  g.quadraticCurveTo(x + w, y, x + w, y + r)
  g.lineTo(x + w, y + h - r)
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  g.lineTo(x + r, y + h)
  g.quadraticCurveTo(x, y + h, x, y + h - r)
  g.lineTo(x, y + r)
  g.quadraticCurveTo(x, y, x + r, y)
  g.closePath()
}
