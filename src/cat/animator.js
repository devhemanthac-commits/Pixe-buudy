// Canvas-based sprite animator.
// The canvas backing store is resized only when the display size actually
// changes — resizing every draw resets the 2D context and kills perf.
// Supports runtime scale changes, CSS-filter color tinting, and hot-swapping
// the sprite sheet (custom buddies).

import { buildSpriteMap } from './sprites.js'

const DEFAULT_MAP = buildSpriteMap()

export class Animator {
  constructor(canvas, spriteSheet, spriteMap = DEFAULT_MAP) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.sheet = spriteSheet // HTMLImageElement or HTMLCanvasElement
    this.map = spriteMap     // { sprites, durations }
    this.state = 'idle'
    this.frameIndex = 0
    this.lastFrameTime = 0
    this.scale = 2           // pixel-art scale factor
    this.flipX = false       // mirror horizontally when facing left
    this.filter = ''         // user color tint, e.g. 'hue-rotate(120deg)'
    this.stateFilter = ''    // mood-driven tint (overheat flush), composed on top
    this.onResize = null     // called when canvas display size changes
    this._rafId = null
    this._onceCallback = null
    this._cw = 0
    this._ch = 0
    this._loop = this._loop.bind(this)
  }

  setState(newState, onComplete = null) {
    if (!this.map.sprites[newState]) return
    if (this.state === newState) return
    this.state = newState
    this.frameIndex = 0
    this.lastFrameTime = 0
    this._onceCallback = onComplete
  }

  // Play a one-shot animation, then return to targetState
  playOnce(state, targetState = 'idle') {
    if (!this.map.sprites[state]) return
    this.state = state
    this.frameIndex = 0
    this.lastFrameTime = 0
    this._onceCallback = () => this.setState(targetState)
  }

  setFlip(flip) {
    this.flipX = !!flip
  }

  // Forces a backing-store resize on the next draw (triggers onResize →
  // the renderer re-reports cat bounds to the hit-test loop)
  setScale(scale) {
    const s = Math.min(8, Math.max(0.5, Number(scale) || 2))
    if (s === this.scale) return
    this.scale = s
    this._cw = 0
    this._ch = 0
  }

  // Swap the sprite sheet (and optionally its frame map) at runtime
  setSheet(sheet, spriteMap = null) {
    this.sheet = sheet
    if (spriteMap) this.map = spriteMap
    if (!this.map.sprites[this.state]) this.state = 'idle'
    this.frameIndex = 0
    this._cw = 0
    this._ch = 0
  }

  start() {
    if (this._rafId != null) return
    this._rafId = requestAnimationFrame(this._loop)
  }

  stop() {
    if (this._rafId != null) cancelAnimationFrame(this._rafId)
    this._rafId = null
  }

  destroy() {
    this.stop()
    this._onceCallback = null
    this.onResize = null
  }

  _loop(timestamp) {
    this._rafId = requestAnimationFrame(this._loop)
    this._update(timestamp)
    this._draw()
  }

  _update(timestamp) {
    const frames = this.map.sprites[this.state]
    if (!frames || frames.length === 0) return

    const duration = this.map.durations[this.state] || 200
    if (timestamp - this.lastFrameTime >= duration) {
      this.lastFrameTime = timestamp
      this.frameIndex++

      if (this.frameIndex >= frames.length) {
        this.frameIndex = 0
        if (this._onceCallback) {
          const cb = this._onceCallback
          this._onceCallback = null
          cb()
        }
      }
    }
  }

  _ensureSize(frame) {
    const dw = Math.round(frame.w * this.scale)
    const dh = Math.round(frame.h * this.scale)
    if (this._cw === dw && this._ch === dh) return

    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.round(dw * dpr)
    this.canvas.height = Math.round(dh * dpr)
    this.canvas.style.width = `${dw}px`
    this.canvas.style.height = `${dh}px`
    // Setting width/height resets the context — reapply state
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.imageSmoothingEnabled = false
    this._cw = dw
    this._ch = dh

    if (this.onResize) this.onResize()
  }

  _draw() {
    const frames = this.map.sprites[this.state]
    if (!frames || frames.length === 0) return
    // Image still loading (canvas sheets have no .complete and pass through)
    if (this.sheet.complete === false) return

    const frame = frames[Math.min(this.frameIndex, frames.length - 1)]
    this._ensureSize(frame)

    const dw = Math.round(frame.w * this.scale)
    const dh = Math.round(frame.h * this.scale)
    const g = this.ctx
    g.clearRect(0, 0, dw, dh)
    const filter = [this.filter, this.stateFilter].filter(Boolean).join(' ')
    g.filter = filter || 'none'

    if (this.flipX) {
      g.save()
      g.translate(dw, 0)
      g.scale(-1, 1)
      g.drawImage(this.sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh)
      g.restore()
    } else {
      g.drawImage(this.sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh)
    }
    g.filter = 'none'
  }
}
