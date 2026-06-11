import { useEffect, useRef, useCallback } from 'react'
import { Animator } from './animator.js'
import { MoodStateMachine, STATES } from './mood.js'

// Served from the `assets/` public dir (vite publicDir) — relative so it
// works both on the dev server and from file:// in the packaged app.
const SPRITE_URL = 'sprites/cat.png'

const CAT_SCALE = 2
const HUNT_VELOCITY = 450   // px/s of global cursor speed → hunt
const HUNT_HOLD_MS = 900
const PET_VELOCITY = 80     // px/s over the cat → petting
const PET_DWELL_MS = 250    // must stay slow this long before purring
const SCROLL_HOLD_MS = 800
const YAWN_CHECK_MS = 60000

export default function Cat() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const moodRef = useRef(null)
  const draggingRef = useRef(false)
  const lastCursorXRef = useRef(null)
  // Local hover tracking for pet detection
  const hoverRef = useRef({ lastX: 0, lastY: 0, lastT: 0, slowSince: null })

  const reportBounds = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !window.electronAPI) return
    const r = canvas.getBoundingClientRect()
    window.electronAPI.setCatBounds({
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let disposed = false
    const cleanups = []

    const init = (sheet) => {
      if (disposed) return

      const anim = new Animator(canvas, sheet)
      anim.scale = CAT_SCALE
      anim.onResize = reportBounds
      anim.start()
      animRef.current = anim

      const mood = new MoodStateMachine()
      mood.onStateChange((state) => anim.setState(state))
      moodRef.current = mood

      reportBounds()
      wireSignals(cleanups)

      // Occasional yawn while idle
      const yawnTimer = setInterval(() => {
        if (moodRef.current?.current === STATES.IDLE && Math.random() < 0.5) {
          animRef.current?.playOnce(STATES.YAWN, STATES.IDLE)
        }
      }, YAWN_CHECK_MS)
      cleanups.push(() => clearInterval(yawnTimer))
    }

    const img = new Image()
    img.onload = () => init(img)
    img.onerror = () => {
      console.warn('[pixe-buudy] sprite sheet missing, using fallback art')
      init(makeFallbackSheet())
    }
    img.src = SPRITE_URL

    const onWinResize = () => reportBounds()
    window.addEventListener('resize', onWinResize)
    cleanups.push(() => window.removeEventListener('resize', onWinResize))

    return () => {
      disposed = true
      cleanups.forEach((fn) => {
        try { fn() } catch {}
      })
      animRef.current?.destroy()
      moodRef.current?.destroy()
      animRef.current = null
      moodRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportBounds])

  function wireSignals(cleanups) {
    const api = window.electronAPI
    if (!api) return // plain browser: cat still idles, walks, and yawns

    cleanups.push(
      api.onMouseMove(({ x, velocity }) => {
        const mood = moodRef.current
        if (!mood || draggingRef.current) return
        if (velocity > HUNT_VELOCITY) {
          const prevX = lastCursorXRef.current
          if (prevX != null && Math.abs(x - prevX) > 2) {
            animRef.current?.setFlip(x < prevX) // face the cursor's direction
          }
          mood.setTemporary(STATES.HUNT, HUNT_HOLD_MS)
        }
        lastCursorXRef.current = x
      })
    )

    cleanups.push(
      api.onScroll(() => {
        moodRef.current?.setTemporary(STATES.SCROLL, SCROLL_HOLD_MS)
      })
    )

    // Typing rate with hysteresis bands so the cat doesn't flicker
    // between states at the thresholds:
    //   enter knead ≥3, exit <2.5; enter overheat ≥8, exit <7
    cleanups.push(
      api.onKeypressRate(({ rate }) => {
        const mood = moodRef.current
        if (!mood) return
        if (rate >= 8) {
          mood.set(STATES.OVERHEAT)
          mood.clear(STATES.KNEAD)
        } else if (rate >= 7) {
          if (!mood.has(STATES.OVERHEAT)) mood.set(STATES.KNEAD)
        } else if (rate >= 3) {
          mood.set(STATES.KNEAD)
          mood.clear(STATES.OVERHEAT)
        } else if (rate >= 2.5) {
          mood.clear(STATES.OVERHEAT)
        } else {
          mood.clear(STATES.KNEAD)
          mood.clear(STATES.OVERHEAT)
        }
      })
    )

    // Sleep/wake driven by the main process (powerMonitor), so it
    // survives renderer reloads and never drifts.
    cleanups.push(
      api.onIdleChange(({ idle }) => {
        const mood = moodRef.current
        if (!mood) return
        if (idle) {
          mood.set(STATES.SLEEP)
        } else if (mood.has(STATES.SLEEP)) {
          mood.clear(STATES.SLEEP)
          animRef.current?.playOnce(STATES.WAKE, STATES.IDLE)
        }
      })
    )

    // Main ends drags on global mouseup as a backstop
    cleanups.push(
      api.onDragEnded(() => {
        draggingRef.current = false
        moodRef.current?.clear(STATES.DRAG)
        reportBounds()
      })
    )
  }

  // ── Pointer handlers on the canvas ─────────────────────────────────────
  const onMouseMove = (e) => {
    const h = hoverRef.current
    const now = performance.now()
    const dt = Math.max(8, now - h.lastT)
    const v = (Math.hypot(e.clientX - h.lastX, e.clientY - h.lastY) / dt) * 1000
    h.lastX = e.clientX
    h.lastY = e.clientY
    h.lastT = now

    const mood = moodRef.current
    if (!mood || draggingRef.current) return

    if (v < PET_VELOCITY) {
      if (h.slowSince == null) h.slowSince = now
      if (now - h.slowSince >= PET_DWELL_MS) mood.set(STATES.PET)
    } else {
      h.slowSince = null
      mood.clear(STATES.PET)
    }
  }

  const onMouseEnter = (e) => {
    const h = hoverRef.current
    h.lastX = e.clientX
    h.lastY = e.clientY
    h.lastT = performance.now()
    h.slowSince = null
  }

  const onMouseLeave = () => {
    hoverRef.current.slowSince = null
    moodRef.current?.clear(STATES.PET)
  }

  const onMouseDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    draggingRef.current = true
    moodRef.current?.clear(STATES.PET)
    moodRef.current?.set(STATES.DRAG)
    // clientX/Y are window-local DIPs — exactly the offset main needs
    window.electronAPI?.dragStart({ offsetX: e.clientX, offsetY: e.clientY })
  }

  const onMouseUp = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    moodRef.current?.clear(STATES.DRAG)
    window.electronAPI?.dragEnd()
  }

  const onContextMenu = (e) => {
    e.preventDefault()
    window.electronAPI?.openSettings()
  }

  return (
    <canvas
      ref={canvasRef}
      className="cat-canvas"
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onContextMenu={onContextMenu}
    />
  )
}

// Procedural sprite sheet so the app never shows a blank window,
// even if assets are missing or fail to load.
function makeFallbackSheet() {
  const COLS = 6
  const ROWS = 11
  const F = 32
  const colors = [
    '#ffc864', '#64c8ff', '#c864ff', '#ff5050', '#6496ff',
    '#ffff64', '#ff96c8', '#ff7832', '#96ff96', '#64dcdc', '#dcdcdc',
  ]

  const sheet = document.createElement('canvas')
  sheet.width = COLS * F
  sheet.height = ROWS * F
  const g = sheet.getContext('2d')

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * F
      const y = row * F
      const bob = col % 2 // 1px bounce between frames
      const color = colors[row % colors.length]

      g.fillStyle = color
      g.fillRect(x + 8, y + 14 + bob, 16, 12)  // body
      g.fillRect(x + 10, y + 6 + bob, 12, 10)  // head
      g.fillRect(x + 10, y + 3 + bob, 3, 4)    // left ear
      g.fillRect(x + 19, y + 3 + bob, 3, 4)    // right ear
      g.fillRect(x + 24, y + 12 + bob, 2, 8)   // tail

      g.fillStyle = '#202020'
      g.fillRect(x + 13, y + 10 + bob, 2, 2)   // eyes
      g.fillRect(x + 18, y + 10 + bob, 2, 2)
    }
  }

  return sheet
}
