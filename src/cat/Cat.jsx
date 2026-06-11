import { useEffect, useRef, useCallback } from 'react'
import { Animator } from './animator.js'
import { MoodStateMachine, STATES } from './mood.js'
import catSheet from '/assets/sprites/cat.png'

const IDLE_TIMEOUT_MS = 3 * 60 * 1000
const HUNT_VELOCITY = 400   // px/s threshold for hunt trigger
const PET_VELOCITY  = 60    // px/s — slow move = petting
const CAT_SCALE     = 2
const FRAME_SIZE    = 32

export default function Cat() {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const moodRef   = useRef(null)
  const idleTimerRef   = useRef(null)
  const dragStartRef   = useRef(null)
  const isHoveredRef   = useRef(false)

  const reportBounds = useCallback(() => {
    if (!canvasRef.current || !window.electronAPI) return
    const rect = canvasRef.current.getBoundingClientRect()
    window.electronAPI.setCatBounds({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    })
  }, [])

  // ── Set up animator + mood machine ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const img = new Image()
    img.src = catSheet
    img.onload = () => {
      const anim = new Animator(canvas, img)
      anim.scale = CAT_SCALE
      anim.start()
      animRef.current = anim

      const mood = new MoodStateMachine()
      mood.onStateChange((state) => {
        anim.setState(state)
      })
      moodRef.current = mood

      reportBounds()
    }

    return () => {
      animRef.current?.stop()
      moodRef.current?.destroy()
    }
  }, [reportBounds])

  // ── Global input listeners (from Electron main via IPC) ──────────────────
  useEffect(() => {
    if (!window.electronAPI) return
    const api = window.electronAPI

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      const mood = moodRef.current
      if (!mood) return
      if (mood.current === STATES.SLEEP) {
        mood.clear(STATES.SLEEP)
        animRef.current?.playOnce('wake', 'idle')
      }
      idleTimerRef.current = setTimeout(() => {
        mood?.set(STATES.SLEEP)
      }, IDLE_TIMEOUT_MS)
    }

    api.onMouseMove(({ velocity }) => {
      resetIdleTimer()
      const mood = moodRef.current
      if (!mood) return

      if (velocity > HUNT_VELOCITY) {
        mood.set(STATES.HUNT)
        // Auto-clear hunt after 1s of no fast movement
        clearTimeout(mood._huntClear)
        mood._huntClear = setTimeout(() => mood.clear(STATES.HUNT), 1000)
      }

      // Petting: cursor hovering near cat at low velocity
      if (isHoveredRef.current && velocity < PET_VELOCITY) {
        mood.set(STATES.PET)
      } else {
        mood.clear(STATES.PET)
      }
    })

    api.onMouseDown(() => resetIdleTimer())
    api.onMouseUp(() => resetIdleTimer())

    api.onScroll(() => {
      resetIdleTimer()
      const mood = moodRef.current
      if (!mood) return
      mood.set(STATES.SCROLL)
      clearTimeout(mood._scrollClear)
      mood._scrollClear = setTimeout(() => mood.clear(STATES.SCROLL), 800)
    })

    api.onKeypressRate(({ rate }) => {
      resetIdleTimer()
      const mood = moodRef.current
      if (!mood) return

      if (rate >= 8) {
        mood.set(STATES.OVERHEAT)
        mood.clear(STATES.KNEAD)
      } else if (rate >= 3) {
        mood.set(STATES.KNEAD)
        mood.clear(STATES.OVERHEAT)
      } else {
        mood.clear(STATES.KNEAD)
        mood.clear(STATES.OVERHEAT)
      }
    })

    // Start the initial idle timer
    resetIdleTimer()

    return () => {
      api.removeAllListeners('mouse-move')
      api.removeAllListeners('mouse-down')
      api.removeAllListeners('mouse-up')
      api.removeAllListeners('scroll')
      api.removeAllListeners('keypress-rate')
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  // ── Drag handling (mouse events on the canvas itself) ────────────────────
  const onMouseEnter = () => {
    isHoveredRef.current = true
  }

  const onMouseLeave = () => {
    isHoveredRef.current = false
    moodRef.current?.clear(STATES.PET)
  }

  const onMouseDown = (e) => {
    if (e.button !== 0) return
    dragStartRef.current = { screenX: e.screenX, screenY: e.screenY }
    moodRef.current?.set(STATES.DRAG)

    const onMouseMove = (ev) => {
      // Electron exposes screen position on MouseEvent when window is transparent
      // We approximate by tracking delta from the IPC cursor position instead
      // The actual window move is handled by the drag IPC
    }

    const onMouseUp = () => {
      moodRef.current?.clear(STATES.DRAG)
      dragStartRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.electronAPI?.startDrag()
  }

  const onContextMenu = (e) => {
    e.preventDefault()
    window.electronAPI?.openSettings()
  }

  return (
    <canvas
      ref={canvasRef}
      className="cat-canvas"
      style={{
        imageRendering: 'pixelated',
        cursor: 'grab',
        display: 'block',
        width: FRAME_SIZE * CAT_SCALE,
        height: FRAME_SIZE * CAT_SCALE,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    />
  )
}
