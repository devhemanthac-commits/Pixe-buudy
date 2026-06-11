// Canvas-based sprite animator.
// The canvas backing store is resized only when the frame size actually
// changes — resizing every draw resets the 2D context and kills perf.

import { SPRITES, FRAME_DURATION } from './sprites.js'

export class Animator {
  constructor(canvas, spriteSheet) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.sheet = spriteSheet // HTMLImageElement or HTMLCanvasElement
    this.state = 'idle'
    this.frameIndex = 0
    this.lastFrameTime = 0
    this.scale = 2          // pixel-art scale factor
    this.flipX = false      // mirror horizontally when facing left
    this.onResize = null    // called when canvas display size changes
    this._rafId = null
    this._onceCallback = null
    this._cw = 0
    this._ch = 0
    this._loop = this._loop.bind(this)
  }

  setState(newState, onComplete = null) {
    if (!SPRITES[newState]) return
    if (this.state === newState) return
    this.state = newState
    this.frameIndex = 0
    this.lastFrameTime = 0
    this._onceCallback = onComplete
  }

  // Play a one-shot animation, then return to targetState
  playOnce(state, targetState = 'idle') {
    if (!SPRITES[state]) return
    this.state = state
    this.frameIndex = 0
    this.lastFrameTime = 0
    this._onceCallback = () => this.setState(targetState)
  }

  setFlip(flip) {
    this.flipX = !!flip
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
    const frames = SPRITES[this.state]
    if (!frames || frames.length === 0) return

    const duration = FRAME_DURATION[this.state] || 200
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
    const dw = frame.w * this.scale
    const dh = frame.h * this.scale
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
    const frames = SPRITES[this.state]
    if (!frames || frames.length === 0) return
    // Image still loading (canvas sheets have no .complete and pass through)
    if (this.sheet.complete === false) return

    const frame = frames[Math.min(this.frameIndex, frames.length - 1)]
    this._ensureSize(frame)

    const dw = frame.w * this.scale
    const dh = frame.h * this.scale
    const g = this.ctx
    g.clearRect(0, 0, dw, dh)

    if (this.flipX) {
      g.save()
      g.translate(dw, 0)
      g.scale(-1, 1)
      g.drawImage(this.sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh)
      g.restore()
    } else {
      g.drawImage(this.sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh)
    }
  }
}
