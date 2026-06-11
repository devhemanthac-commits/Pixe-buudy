// Canvas-based sprite animator
// Usage: const anim = new Animator(canvas, spriteSheet)
//        anim.setState('idle')
//        anim.start()

import { SPRITES, FRAME_DURATION } from './sprites.js'

export class Animator {
  constructor(canvas, spriteSheet) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.sheet = spriteSheet
    this.state = 'idle'
    this.frameIndex = 0
    this.lastFrameTime = 0
    this.rafId = null
    this.scale = 2         // pixel-art scale factor
    this.flipX = false     // mirror horizontally when walking left
    this._onceCallback = null
  }

  setState(newState, onComplete) {
    if (!SPRITES[newState]) return
    if (this.state === newState) return
    this.state = newState
    this.frameIndex = 0
    this.lastFrameTime = 0
    this._onceCallback = onComplete || null
  }

  // Play a one-shot animation then return to targetState
  playOnce(state, targetState) {
    if (!SPRITES[state]) return
    this.state = state
    this.frameIndex = 0
    this.lastFrameTime = 0
    this._onceCallback = () => this.setState(targetState || 'idle')
  }

  start() {
    if (this.rafId) return
    this._loop(performance.now())
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  _loop(timestamp) {
    this.rafId = requestAnimationFrame((ts) => this._loop(ts))
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

  _draw() {
    const frames = SPRITES[this.state]
    if (!frames || !this.sheet.complete) return

    const frame = frames[this.frameIndex]
    const dw = frame.w * this.scale
    const dh = frame.h * this.scale

    this.canvas.width = dw
    this.canvas.height = dh
    this.ctx.clearRect(0, 0, dw, dh)

    if (this.flipX) {
      this.ctx.save()
      this.ctx.scale(-1, 1)
      this.ctx.drawImage(this.sheet, frame.x, frame.y, frame.w, frame.h, -dw, 0, dw, dh)
      this.ctx.restore()
    } else {
      this.ctx.drawImage(this.sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh)
    }
  }

  setFlip(flip) {
    this.flipX = flip
  }
}
