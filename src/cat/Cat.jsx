import { useEffect, useRef, useCallback } from 'react'
import { Animator } from './animator.js'
import { MoodStateMachine, STATES } from './mood.js'
import { buildSpriteMap, STATE_ROWS } from './sprites.js'
import { CatPhysics } from './physics.js'
import { Effects } from './effects.js'
import { XpSystem } from './xp.js'
import {
  playMeow, playPurr, playSteam, playBounce, playLevelUp, playWake, playChime,
} from './sound.js'
import { DEFAULT_SETTINGS, normalizeSettings, buildFilter } from '../settings.js'

const SPRITE_URL = 'sprites/cat.png'

const HUNT_VELOCITY  = 450
const HUNT_HOLD_MS   = 900
const PET_VELOCITY   = 80
const PET_DWELL_MS   = 250
const SCROLL_HOLD_MS = 800
const IDLE_VARIETY_MS = 45000
const FACE_DEADZONE_PX = 24
const SHAKE_WINDOW_MS  = 700
const SHAKE_REVERSALS  = 3
const OVERHEAT_FLUSH   = 'saturate(165%) hue-rotate(-25deg) brightness(106%)'

// Time typing must be continuous before the stretch reminder fires
const STRETCH_WARN_MS = 25 * 60 * 1000  // 25 minutes
// Gap in typing that resets the session clock
const STRETCH_BREAK_MS = 5 * 60 * 1000// 5 minutes gap = new session

const IDLE_VARIANTS = [STATES.YAWN, STATES.STRETCH, STATES.SIT, STATES.DANCE, STATES.PLAY]

// Idle variants biased by active app context
const APP_VARIANTS = {
  code:    [STATES.SIT, STATES.SIT, STATES.YAWN, STATES.STRETCH, STATES.PLAY],
  media:   [STATES.DANCE, STATES.DANCE, STATES.PLAY, STATES.YAWN, STATES.SIT],
  reading: [STATES.YAWN, STATES.YAWN, STATES.SIT, STATES.STRETCH, STATES.PLAY],
  default: IDLE_VARIANTS,
}

const EMITTERS = {
  [STATES.OVERHEAT]: { type: 'steam',   everyMs: 260, at: 'head' },
  [STATES.SLEEP]:    { type: 'zzz',     everyMs: 1500 },
  [STATES.PET]:      { type: 'heart',   everyMs: 450 },
}

export default function Cat() {
  const canvasRef    = useRef(null)
  const wrapRef      = useRef(null)
  const stageRef     = useRef(null)
  const fxRef        = useRef(null)
  const stretchTipRef = useRef(null)

  const animRef     = useRef(null)
  const moodRef     = useRef(null)
  const physicsRef  = useRef(null)
  const effectsRef  = useRef(null)
  const xpRef       = useRef(null)

  const settingsRef  = useRef(DEFAULT_SETTINGS)
  const sheetSrcRef  = useRef(null)
  const draggingRef  = useRef(false)
  const dragTrackRef = useRef({ lastX: null, lastY: null, lastDir: 0, reversals: [] })
  const hoverRef     = useRef({ lastX: 0, lastY: 0, lastT: 0, slowSince: null })
  const emitNextRef  = useRef(0)
  const appContextRef = useRef('default') // 'code'|'media'|'reading'|'default'

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

      // XP system: level-up triggers sparkle burst + arpeggio
      const xp = new XpSystem((newLevel) => {
        const r = canvasRef.current?.getBoundingClientRect()
        if (r) effects.burst(r.left + r.width / 2, r.top + r.height / 2)
        if (settingsRef.current.sound) playLevelUp()
      })
      xpRef.current = xp
      xp.load()  // fire-and-forget async load from store

      // ── Mood state machine ─────────────────────────────────────────────
      let prevMoodState = STATES.IDLE
      // Name tip overlay: fades in when petting, out when not
      let nameTipAlpha = 0
      let nameTipTarget = 0

      const mood = new MoodStateMachine()
      mood.onStateChange((state) => {
        const prev = prevMoodState
        prevMoodState = state

        anim.setState(state)
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

        // ── Sounds ───────────────────────────────────────────────────────
        const sound = settingsRef.current.sound
        if (sound) {
          if (state === STATES.PET && prev !== STATES.PET)           playPurr()
          if (state === STATES.OVERHEAT && prev !== STATES.OVERHEAT) playSteam()
          if (prev === STATES.DRAG && state !== STATES.DRAG)         playBounce()
        }

        // ── XP awards ────────────────────────────────────────────────────
        if (state === STATES.PET      && prev !== STATES.PET)      xp.award('pet')
        if (state === STATES.OVERHEAT && prev !== STATES.OVERHEAT) xp.award('overheat')
        if (state === STATES.KNEAD    && prev !== STATES.KNEAD)    xp.award('knead')
        if (prev  === STATES.DRAG     && state !== STATES.DRAG)    xp.award('drag')

        // ── Name tip ─────────────────────────────────────────────────────
        nameTipTarget = state === STATES.PET ? 1 : 0
      })
      moodRef.current = mood

      physics.ensureInBounds(window.innerWidth)
      reportBounds()
      wireSignals(cleanups)

      // ── Shared rAF: physics + particles + overlays ─────────────────────
      let lastTs = performance.now()
      let rafId = requestAnimationFrame(function loop(ts) {
        rafId = requestAnimationFrame(loop)
        const dt = Math.min(0.05, (ts - lastTs) / 1000)
        lastTs = ts

        physics.tick(dt)
        effects.tick(dt)
        runEmitters(ts)

        // Smooth name-tip alpha
        nameTipAlpha += (nameTipTarget - nameTipAlpha) * Math.min(1, dt * 7)

        // Update canvas overlay every frame
        const r = canvasRef.current?.getBoundingClientRect()
        if (r) {
          effects.setOverlay({
            nameTip: {
              visible: nameTipAlpha > 0.01,
              text: settingsRef.current.name || 'Buddy',
              x: r.left + r.width / 2,
              y: r.top - 4,
              alpha: nameTipAlpha,
            },
            levelBadge: xp.level > 0 ? {
              visible: true,
              text: xp.label(),
              x: r.right + 2,
              y: r.top + 2,
            } : null,
          })
        }
      })
      cleanups.push(() => cancelAnimationFrame(rafId))

      // ── Idle variety: biased by app context ───────────────────────────
      const varietyTimer = setInterval(() => {
        if (moodRef.current?.current !== STATES.IDLE) return
        if (Math.random() > 0.58) return
        const variants = APP_VARIANTS[appContextRef.current] || IDLE_VARIANTS
        const pick = variants[Math.floor(Math.random() * variants.length)]
        animRef.current?.playOnce(pick, STATES.IDLE)
        if (pick === STATES.DANCE) {
          xp.award('dance')
          if (settingsRef.current.sound) playMeow()
        }
      }, IDLE_VARIETY_MS)
      cleanups.push(() => clearInterval(varietyTimer))

      // Live settings from the settings window
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
      const x = r.left + r.width / 2
      const y = emitter.type === 'sparkle' ? r.top + r.height / 2 : r.top + 2
      effectsRef.current?.spawn(emitter.type, x, y)
    }

    const loadSheet = (s) => {
      const src = s.customSheet || SPRITE_URL
      sheetSrcRef.current = src

      const useSheet = (sheet, w, h) => {
        if (disposed || sheetSrcRef.current !== src) return
        const map = buildSpriteMap({
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
      cleanups.forEach((fn) => { try { fn() } catch {} })
      animRef.current?.destroy()
      moodRef.current?.destroy()
      physicsRef.current?.destroy()
      effectsRef.current?.destroy()
      animRef.current = null
      moodRef.current = null
      physicsRef.current = null
      effectsRef.current = null
      xpRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportBounds])

  // ── IPC signal wiring ─────────────────────────────────────────────────────
  function wireSignals(cleanups) {
    const api = window.electronAPI
    if (!api) return

    // Stretch reminder: track continuous typing time
    let lastTypingTs = 0        // timestamp of last keypress-rate event with rate≥1
    let sessionStart = 0        // when this typing session began
    let stretchFired = false    // whether we already fired the reminder this session

    const checkStretch = setInterval(() => {
      const now = Date.now()
      if (lastTypingTs === 0) return

      if (now - lastTypingTs > STRETCH_BREAK_MS) {
        // Typing stopped long enough — reset session
        sessionStart = 0
        stretchFired = false
        lastTypingTs = 0
        return
      }

      if (stretchFired) return

      if (sessionStart && now - sessionStart >= STRETCH_WARN_MS) {
        stretchFired = true
        triggerStretchReminder()
      }
    }, 30000) // check every 30 s is plenty
    cleanups.push(() => clearInterval(checkStretch))

    function triggerStretchReminder() {
      if (moodRef.current?.has(STATES.DRAG)) return
      if (settingsRef.current.sound) playChime()
      animRef.current?.playOnce(STATES.STRETCH, STATES.IDLE)
      const tip = stretchTipRef.current
      if (tip) {
        tip.classList.add('visible')
        setTimeout(() => tip?.classList.remove('visible'), 5000)
      }
    }

    cleanups.push(
      api.onMouseMove(({ x, y, velocity }) => {
        const mood = moodRef.current
        const physics = physicsRef.current
        if (!mood || !physics) return

        if (draggingRef.current) {
          trackDrag(x, y)
          return
        }

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

    cleanups.push(
      api.onKeypressRate(({ rate }) => {
        const mood = moodRef.current
        if (!mood) return

        // Typing-session clock for stretch reminder
        if (rate >= 1) {
          const now = Date.now()
          lastTypingTs = now
          if (!sessionStart) sessionStart = now
        }

        // Hysteresis: enter knead≥3, exit<2.5; enter overheat≥8, exit<7
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

    cleanups.push(
      api.onIdleChange(({ idle }) => {
        const mood = moodRef.current
        if (!mood) return
        if (idle) {
          mood.set(STATES.SLEEP)
        } else if (mood.has(STATES.SLEEP)) {
          mood.clear(STATES.SLEEP)
          animRef.current?.playOnce(STATES.WAKE, STATES.IDLE)
          if (settingsRef.current.sound) playWake()
          xpRef.current?.award('wake')
        }
      })
    )

    cleanups.push(
      api.onDragEnded(() => {
        if (draggingRef.current || moodRef.current?.has(STATES.DRAG)) {
          endLocalDrag()
        }
        reportBounds()
      })
    )

    // App awareness: bias idle variety and react to context switches
    cleanups.push(
      api.onActiveApp(({ name }) => {
        if (!name) return
        const n = name.toLowerCase()
        let ctx = 'default'
        if (/code|vim|nvim|emacs|terminal|iterm|bash|zsh|kitty|alacritty|hyper|warp|cursor/.test(n)) {
          ctx = 'code'
        } else if (/youtube|spotify|music\.app|vlc|netflix|plex|tidal|soundcloud|amazon music/.test(n)) {
          ctx = 'media'
        } else if (/notion|obsidian|docs|pages|word|writer|bear|typora|logseq/.test(n)) {
          ctx = 'reading'
        }
        appContextRef.current = ctx
      })
    )
  }

  function trackDrag(x, y) {
    const t = dragTrackRef.current
    if (t.lastX != null) {
      const dx = x - t.lastX
      const dy = y - t.lastY
      physicsRef.current?.setDragPull(dx, dy)

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
    t.lastX = null; t.lastY = null; t.lastDir = 0; t.reversals.length = 0
    physicsRef.current?.release()
    moodRef.current?.clear(STATES.DRAG)
  }

  // ── Pointer handlers ──────────────────────────────────────────────────────
  const onMouseMove = (e) => {
    const h = hoverRef.current
    const now = performance.now()
    const dt = Math.max(8, now - h.lastT)
    const v = (Math.hypot(e.clientX - h.lastX, e.clientY - h.lastY) / dt) * 1000
    h.lastX = e.clientX; h.lastY = e.clientY; h.lastT = now

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
    h.lastX = e.clientX; h.lastY = e.clientY
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
      <div ref={stretchTipRef} className="cat-stretch-tip" aria-hidden="true">
        Time to stretch!
      </div>
    </div>
  )
}

// Procedural fallback sprite — renders even with zero assets
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
      const bob = col % 2
      const color = colors[row % colors.length]

      g.fillStyle = color
      g.fillRect(x + 8,  y + 14 + bob, 16, 12)
      g.fillRect(x + 10, y + 6  + bob, 12, 10)
      g.fillRect(x + 10, y + 3  + bob, 3,  4)
      g.fillRect(x + 19, y + 3  + bob, 3,  4)
      g.fillRect(x + 24, y + 12 + bob, 2,  8)

      g.fillStyle = '#202020'
      g.fillRect(x + 13, y + 10 + bob, 2, 2)
      g.fillRect(x + 18, y + 10 + bob, 2, 2)
    }
  }

  return sheet
}
