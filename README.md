<div align="center">

# Pixe-buudy

<img src="docs/anims/dance.gif" width="96" alt="Pixe-buudy dancing">

**A pixel cat that lives on your desktop and reacts to everything you do.**

Typing, scrolling, flinging the mouse around, wandering off for coffee — the buddy notices.

[![License: MIT](https://img.shields.io/badge/License-MIT-a29bfe.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-81ecec.svg)](#contributing)

</div>

---

The buddy sits in a transparent, always-on-top window. Clicks pass straight through to whatever's underneath — except when your cursor is over the buddy itself. Drag it anywhere, pet it, recolor it, resize it, or replace it with your own sprite sheet entirely.

## How it reacts

| | You... | The buddy... |
|---|---|---|
| <img src="docs/anims/idle.gif" width="56" alt="idle"> | move the cursor anywhere | watches it — faces your cursor and leans toward it |
| <img src="docs/anims/knead.gif" width="56" alt="knead"> | type at a steady pace | kneads along with you |
| <img src="docs/anims/overheat.gif" width="56" alt="overheat"> | type furiously (8+ keys/s) | flushes red with **steam puffing** off its head |
| <img src="docs/anims/hunt.gif" width="56" alt="hunt"> | fling the cursor across the screen | hunts it, facing the direction of travel |
| <img src="docs/anims/scroll.gif" width="56" alt="scroll"> | scroll | bats at the "paper" |
| <img src="docs/anims/pet.gif" width="56" alt="pet"> | hover slowly over it | closes its eyes, purrs, **hearts float up** |
| <img src="docs/anims/drag.gif" width="56" alt="drag"> | grab and pull it | **mochi-stretches** along your pull, leans into the motion |
| <img src="docs/anims/drag.gif" width="56" alt="shake"> | shake it while holding | **wiggles** dizzily |
| <img src="docs/anims/drag.gif" width="56" alt="release"> | let go | lands with a **springy squash-and-bounce** |
| <img src="docs/anims/sleep.gif" width="56" alt="sleep"> | go idle for 3 minutes | curls up, breathes slowly, **ZZZ drift up** |
| <img src="docs/anims/wake.gif" width="56" alt="wake"> | come back | yawns, stretches, back to work |

When you leave it alone, it won't just sit there either — it **walks across its perch**, breathes, yawns, stretches, sits, plays, and dances with **sparkles**.

### Two animation layers

Every reaction above is the product of two independent systems that compose:

1. **Sprite layer** — 15 hand-drawn (or imported) frame animations
2. **Procedural layer** — spring physics (mochi stretch, wiggle, landing bounce, breathing, cursor-tilt) + a pixel particle engine (steam, ZZZ, hearts, sparkles)

Because the procedural layer is math, not art, **it works on any custom sprite sheet you import** — your buddy gets the full mochi/particle treatment for free.

## Every animation

| | | | | |
|:---:|:---:|:---:|:---:|:---:|
| <img src="docs/anims/idle.gif" width="80" alt="idle"> | <img src="docs/anims/walk.gif" width="80" alt="walk"> | <img src="docs/anims/knead.gif" width="80" alt="knead"> | <img src="docs/anims/overheat.gif" width="80" alt="overheat"> | <img src="docs/anims/sleep.gif" width="80" alt="sleep"> |
| `idle` | `walk` | `knead` | `overheat` | `sleep` |
| <img src="docs/anims/wake.gif" width="80" alt="wake"> | <img src="docs/anims/pet.gif" width="80" alt="pet"> | <img src="docs/anims/hunt.gif" width="80" alt="hunt"> | <img src="docs/anims/drag.gif" width="80" alt="drag"> | <img src="docs/anims/scroll.gif" width="80" alt="scroll"> |
| `wake` | `pet` | `hunt` | `drag` | `scroll` |
| <img src="docs/anims/yawn.gif" width="80" alt="yawn"> | <img src="docs/anims/stretch.gif" width="80" alt="stretch"> | <img src="docs/anims/sit.gif" width="80" alt="sit"> | <img src="docs/anims/dance.gif" width="80" alt="dance"> | <img src="docs/anims/play.gif" width="80" alt="play"> |
| `yawn` | `stretch` | `sit` | `dance` | `play` |

> The previews above are rendered from the bundled placeholder sheet by [`scripts/generate-readme-anims.py`](scripts/generate-readme-anims.py) — swap in real art at `assets/sprites/cat.png`, re-run the script, and this gallery updates itself.

## How it compares

Inspired by the lovely [Comnyang](https://comnyang.com/) — and built to go further:

| | Pixe-buudy | Comnyang |
|---|:---:|:---:|
| Cursor watching (faces + leans toward cursor) | ✅ | ✅ eyes follow |
| Typing reactions (knead / overheat + steam) | ✅ | ✅ |
| Mochi stretch on drag | ✅ physics-driven, stretches along pull | ✅ |
| Shake → wiggle | ✅ | ✅ |
| Cursor hunting | ✅ | ✅ |
| Petting → purr + hearts | ✅ | ✅ |
| Scroll reaction | ✅ | ✅ |
| Sleep mode with ZZZ + breathing | ✅ | — |
| Wanders around on its own | ✅ walks its perch | — |
| Self-entertaining idle (yawn/stretch/sit/dance/play) | ✅ 5 variants | — |
| Landing squash-and-bounce on release | ✅ | — |
| Custom sprite sheets (bring any character) | ✅ any PNG | markings only |
| Size scaling (1×–6×) | ✅ | — |
| Full recolor (hue/sat/brightness + presets) | ✅ | — |
| Open source | ✅ MIT | — |
| Price | **Free** | $3.90 |

## Quick start

```bash
git clone https://github.com/devhemanthac-commits/Pixe-buudy.git
cd Pixe-buudy
npm install
npm run dev      # Vite dev server + Electron, hot reload
```

Production build:

```bash
npm run build    # installers land in dist-electron/
```

### Platform notes

| Platform | Notes |
|---|---|
| **macOS** | Global input hooks need Accessibility permission (System Settings → Privacy & Security → Accessibility). App-awareness needs Screen Recording permission. |
| **Windows** | Works out of the box. |
| **Linux** | Transparency requires a compositor (picom, KWin, and Mutter all work). Wayland limits global hooks — X11 sessions get the full experience. |

## Customization

Right-click the buddy → **Settings**:

| | |
|---|---|
| 🔍 **Size** | 1×–6× pixel scale, applied live — click detection adjusts automatically |
| 🎨 **Color** | Preset coats (Ginger, Sky, Sakura, Mint, Grape, Ash) or fine-tune hue / saturation / brightness with a live preview |
| 🐾 **Custom buddy** | Import your own sprite sheet (PNG, ≤2MB, any frame size) — persisted across restarts |
| ✏️ **Name** | Used in reminder messages |
| 🔊 **Sound** | Meow / purr toggle |

### Bring your own buddy

One row per animation, frames left to right:

```
idle, walk, knead, overheat, sleep, wake, pet, hunt,
drag, scroll, yawn, stretch, sit, dance, play
```

The loader is forgiving by design:

- **Fewer than 15 rows?** Missing states fall back to the idle row.
- **Narrower sheet?** Frame counts cap to what actually fits.
- **Different frame size?** Set it in Settings (default 32×32).

Row definitions live in [`src/cat/sprites.js`](src/cat/sprites.js).

## Architecture

```
electron/
  main.js        window management, hit-test loop, drag, IPC, idle watcher
  preload.js     contextBridge API (contextIsolation on, nodeIntegration off)
  hooks/         uiohook velocity/rate trackers, active-win polling
src/
  cat/
    Cat.jsx      wires IPC signals → mood machine → animator
    mood.js      priority-resolved state machine with temporary flags
    animator.js  rAF canvas renderer — DPR-aware, resize-free, tint + hot sheet swap
    sprites.js   sprite sheet frame maps (adapts to any sheet)
  Settings.jsx   settings window UI (live-syncs to the cat window)
assets/sprites/  sprite sheets (vite publicDir, served at web root)
```

### Design notes

- **Click-through window** — `setIgnoreMouseEvents(true, { forward: true })` by default; a 16ms hit-test loop in the main process re-enables mouse events only while the cursor is inside the buddy's reported bounds.
- **Drag that can't get stuck** — the renderer reports the grab offset, the main process moves the window with the global cursor each tick, and a global-mouseup backstop guarantees release.
- **Mood priority resolution** — `DRAG > PET > OVERHEAT > HUNT > KNEAD > SCROLL > WALK > IDLE > SLEEP`; signals set/clear flags and the machine resolves the winner, so reactions never fight.
- **Steady, not jittery** — IPC throttled (mouse ~30Hz, typing rate on change every 250ms), hysteresis bands on typing thresholds, idle/sleep driven by `powerMonitor` in the main process.
- **Crash-proof** — single-instance lock, renderer crash auto-reload with loop detection, uncaught-exception guards, and a procedural fallback sprite so the buddy renders even with zero assets.

## Roadmap

- [x] Transparent click-through window with hit-testing
- [x] Sprite animator + mood state machine
- [x] Global input reactions (typing, scrolling, cursor, idle)
- [x] Custom buddies, size, and color
- [ ] Persistent mood score & XP / level system
- [ ] App awareness (focused face in your editor, bobbing to music)
- [ ] Pomodoro timer + stretch reminders
- [ ] Sounds (meow, purr, level-up)
- [ ] Auto-launch on startup & auto-updates

## Contributing

Issues and PRs welcome. The codebase is small and commented — `electron/main.js` and `src/cat/Cat.jsx` are the two files that explain everything else.

```bash
npm run dev          # hack with hot reload
npm run build:web    # verify the renderer builds
python3 scripts/generate-readme-anims.py   # regenerate the README gallery
```

## License

[MIT](LICENSE) — do whatever makes your desktop happier.
