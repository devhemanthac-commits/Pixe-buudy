import { useEffect, useRef, useCallback } from 'react'
import { Animator } from './animator.js'
import { MoodStateMachine, STATES } from './mood.js'
import { buildSpriteMap, STATE_ROWS } from './sprites.js'
import { CatPhysics } from './physics.js'
import { Effects } from './effects.js'
import { DEFAULT_SETTINGS, normalizeSettings, buildFilter } from '../settings.js'

// Served from the `assets/` public dir (vite publicDir) — relative so it
// works both on the dev server and from file:// in the packaged app.
const SPRITE_URL = 'sprites/cat.png'

const HUNT_VELOCITY = 450   // px/s of global cursor speed → hunt
const HUNT_HOLD_MS = 900
const PET_VELOCITY = 80     // px/s over the cat → petting
const PET_DWELL_MS = 250    // must stay slow this long before purring
const SCROLL_HOLD_MS = 800
const IDLE_VARIETY_MS = 45000
const FACE_DEADZONE_PX = 24 // don't flip when the cursor is basically on the cat
const SHAKE_WINDOW_MS = 700 // direction reversals inside this window = a shake
const SHAKE_REVERSALS = 3
const OVERHEAT_FLUSH = 'saturate(165%) hue-rotate(-25deg) brightness(106%)'

// One-shots the cat picks from when idling
const IDLE_VARIANTS = [STATES.YAWN, STATES.STRETCH, STATES.SIT, STATES.DANCE, STATES.PLAY]

// Particle emitters per mood state: type + spawn interval
const EMITTERS = {
  [STATES.OVERHEAT]: { type: 'steam', everyMs: 240, at: 'head' },
  [STATES.SLEEP]:    { type: 'zzz', everyMs: 1500, at: 'head' },
  [STATES.PET]:      { type: 'heart', everyMs: 420, at: 'head' },
}

export default function Cat() {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const stageRef = useRef(null)
  const fxRef = useRef(null)

  const animRef = useRef(null)
  const moodRef = useRef(null)
  const physicsRef = useRef(null)
  const effectsRef = useRef(null)
  const settingsRef = useRef(DEFAULT_SETTINGS)
  const sheetSrcRef = useRef(null)
  const draggingRef = useRef(false)
  // Drag pull + shake detection from global cursor deltas while held
  const dragTrackRef = useRef({ lastX: null, lastY: null, lastDir: 0, reversals: [] })
  // Local hover tracking for pet detection
  const hoverRef = useRef({ lastX: 0, lastY: 0, lastT: 0, slowSince: null })
  const emitNextRef = useRef(0)

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

    const initAnim = (sheet, map, s) => {
      const anim = new Animator(canvas, sheet, map)
      anim.setScale(s.scale)
      anim.filter = buildFilter(s)
      anim.onResize = () => {
        physicsRef.current?.ensureInBounds(window.innerWidth)
        reportBounds()
      }
      anim.start()
      animRef.current = anim

      const physics = new CatPhysics(wrapRef.current, { onMoved: reportBounds })
      physicsRef.current = physics

      const effects = new Effects(fxRef.current)
      effectsRef.current = effects

      const mood = new MoodStateMachine()
      mood.onStateChange((state) => {
        anim.setState(state)
        // Mood side effects on the procedural layers
        anim.stateFilter = state === STATES.OVERHEAT ? OVERHEAT_FLUSH : ''
        physics.setBreathing(
          state === STATES.SLEEP ? 'sleep' : state === STATES.IDLE ? 'idle' : null
        )
        if (state === STATES.WALK) {
          const dir = physics.startWalk(window.innerWidth)
          anim.setFlip(dir < 0)
        } else if (physics.walking()) {
          physics.stopWalk()
        }
      })
      moodRef.current = mood

      physics.ensureInBounds(window.innerWidth)
      reportBounds()
      wireSignals(cleanups)

      // One shared rAF for physics, particles, and state emitters
      let lastTs = performance.now()
      let rafId = requestAnimationFrame(function loop(ts) {
        rafId = requestAnimationFrame(loop)
        const dt = Math.min(0.05, (ts - lastTs) / 1000)
        lastTs = ts
        physics.tick(dt)
        effects.tick(dt)
        runEmitters(ts)
      })
      cleanups.push(() => cancelAnimationFrame(rafId))

      // Occasional idle variety: yawn, stretch, sit, dance, play
      const varietyTimer = setInterval(() => {
        if (moodRef.current?.current === STATES.IDLE && Math.random() < 0.6) {
          const pick = IDLE_VARIANTS[Math.floor(Math.random() * IDLE_VARIANTS.length)]
          animRef.current?.playOnce(pick, STATES.IDLE)
        }
      }, IDLE_VARIETY_MS)
      cleanups.push(() => clearInterval(varietyTimer))

      // Live settings updates from the settings window
      if (window.electronAPI) {
        cleanups.push(
          window.electronAPI.onSettingsChanged((raw) => {
            applySettings(normalizeSettings(raw))
          })
        )
      }
    }

    const runEmitters = (ts) => {
      const state = moodRef.current?.current
      const dancing = animRef.current?.state === STATES.DANCE
      const emitter = EMITTERS[state] || (dancing ? { type: 'sparkle', everyMs: 200 } : null)
      if (!emitter) return
      if (ts < emitNextRef.current) return
      emitNextRef.current = ts + emitter.everyMs
      const r = canvasRef.current?.getBoundingClientRect()
      if (!r) return
      // 'head' = just above the sprite's top center; sparkles use body center
      const x = r.left + r.width / 2
      const y = emitter.type === 'sparkle' ? r.top + r.height / 2 : r.top + 2
      effectsRef.current?.spawn(emitter.type, x, y)
    }

    const loadSheet = (s) => {
      const src = s.customSheet || SPRITE_URL
      sheetSrcRef.current = src

      const useSheet = (sheet, w, h) => {
        if (disposed || sheetSrcRef.current !== src) return // stale load
        const map = buildSpriteMap({
          // undefined → buildSpriteMap's defaults for the bundled sheet
          frameW: s.customSheet ? s.frameW : undefined,
          frameH: s.customSheet ? s.frameH : undefined,
          sheetW: w,
          sheetH: h,
        })
        if (!animRef.current) initAnim(sheet, map, s)
        else animRef.current.setSheet(sheet, map)
      }

      const img = new Image()
      img.onload = () => useSheet(img, img.naturalWidth, img.naturalHeight)
      img.onerror = () => {
        if (disposed) return
        console.warn('[pixe-buudy] sprite sheet failed to load, using fallback art')
        const stale = sheetSrcRef.current !== src
        // A stale failure must still init if nothing rendered yet —
        // otherwise two failed loads in a row leave the cat blank forever.
        // (A later successful load self-heals via setSheet.)
        if (stale && animRef.current) return
        const fb = makeFallbackSheet()
        const map = buildSpriteMap({ sheetW: fb.width, sheetH: fb.height })
        if (!animRef.current) initAnim(fb, map, s)
        else animRef.current.setSheet(fb, map)
      }
      img.src = src
    }

    const applySettings = (s) => {
      const prev = settingsRef.current
      settingsRef.current = s
      const anim = animRef.current
      if (!anim) return
      anim.setScale(s.scale)
      anim.filter = buildFilter(s)
      const src = s.customSheet || SPRITE_URL
      if (src !== sheetSrcRef.current || s.frameW !== prev.frameW || s.frameH !== prev.frameH) {
        loadSheet(s)
      }
    }

    const start = async () => {
      let stored = null
      try {
        stored = await window.electronAPI?.getStore('settings', null)
      } catch (err) {
        console.warn('[pixe-buudy] could not load settings, using defaults:', err)
      }
      if (disposed) return
      const s = normalizeSettings(stored)
      settingsRef.current = s
      loadSheet(s)
    }
    start()

    const onWinResize = () => {
      effectsRef.current?.resize()
      physicsRef.current?.ensureInBounds(window.innerWidth)
      reportBounds()
    }
    window.addEventListener('resize', onWinResize)
    cleanups.push(() => window.removeEventListener('resize', onWinResize))

    return () => {
      disposed = true
      cleanups.forEach((fn) => {
        try { fn() } catch {}
      })
      animRef.current?.destroy()
      moodRef.current?.destroy()
      physicsRef.current?.destroy()
      effectsRef.current?.destroy()
      animRef.current = null
      moodRef.current = null
      physicsRef.current = null
      effectsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportBounds])

  function wireSignals(cleanups) {
    const api = window.electronAPI
    if (!api) return // plain browser: cat still idles, walks, and yawns

    cleanups.push(
      api.onMouseMove(({ x, y, velocity }) => {
        const mood = moodRef.current
        const physics = physicsRef.current
        if (!mood || !physics) return

        if (draggingRef.current) {
          trackDrag(x, y)
          return
        }

        // Cursor watching: face + lean toward the cursor (Comnyang's
        // eye-tracking equivalent, but works with any sprite sheet)
        const r = canvasRef.current?.getBoundingClientRect()
        if (r && !physics.walking()) {
          const centerX = window.screenX + r.left + r.width / 2
          const dx = x - centerX
          if (Math.abs(dx) > FACE_DEADZONE_PX) animRef.current?.setFlip(dx < 0)
          physics.setTilt(dx / 60)
        }

        if (velocity > HUNT_VELOCITY) {
          mood.setTemporary(STATES.HUNT, HUNT_HOLD_MS)
        }
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
        if (draggingRef.current || moodRef.current?.has(STATES.DRAG)) {
          endLocalDrag()
        }
        reportBounds()
      })
    )
  }

  // Mochi stretch + shake detection from global cursor deltas while held
  function trackDrag(x, y) {
    const t = dragTrackRef.current
    if (t.lastX != null) {
      const dx = x - t.lastX
      const dy = y - t.lastY
      physicsRef.current?.setDragPull(dx, dy)

      // Shake: rapid horizontal direction reversals → wiggle
      const dir = Math.sign(dx)
      if (dir !== 0 && t.lastDir !== 0 && dir !== t.lastDir && Math.abs(dx) > 3) {
        const now = Date.now()
        t.reversals.push(now)
        while (t.reversals.length && t.reversals[0] < now - SHAKE_WINDOW_MS) t.reversals.shift()
        if (t.reversals.length >= SHAKE_REVERSALS) {
          t.reversals.length = 0
          physicsRef.current?.impulseWiggle()
        }
      }
      if (dir !== 0) t.lastDir = dir
    }
    t.lastX = x
    t.lastY = y
  }

  function endLocalDrag() {
    draggingRef.current = false
    const t = dragTrackRef.current
    t.lastX = null
    t.lastY = null
    t.lastDir = 0
    t.reversals.length = 0
    physicsRef.current?.release() // springy landing bounce
    moodRef.current?.clear(STATES.DRAG)
  }

  // ── Pointer handlers on the canvas ─────────────────────────────────────
  // Pet detection uses local per-event velocity (DOM events arrive at most
  // ~60Hz, so the dt floor is safe here). Global cursor velocity for HUNT
  // is computed separately in electron/hooks/mouse.js, which must handle
  // 1000Hz+ mice — don't unify the two without keeping that property.
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
    endLocalDrag()
    window.electronAPI?.dragEnd()
  }

  const onContextMenu = (e) => {
    e.preventDefault()
    window.electronAPI?.openSettings()
  }

  return (
    <div className="cat-stage" ref={stageRef}>
      <canvas ref={fxRef} className="fx-canvas" />
      <div className="cat-wrap" ref={wrapRef}>
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
      </div>
    </div>
  )
}

// Procedural sprite sheet so the app never shows a blank window,
// even if assets are missing or fail to load. One row per state.
function makeFallbackSheet() {
  const F = 32
  const COLS = Math.max(...STATE_ROWS.map(([, count]) => count))
  const ROWS = STATE_ROWS.length
  const colors = [
    '#ffc864', '#64c8ff', '#c864ff', '#ff5050', '#6496ff',
    '#ffff64', '#ff96c8', '#ff7832', '#96ff96', '#64dcdc',
    '#dcdcdc', '#a0e860', '#e8a060', '#f060e8', '#60f0a8',
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
