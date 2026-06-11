# Pixe-buudy 🐱

A pixel cat that lives on your desktop and reacts to what you do — typing, scrolling, flinging the mouse around, or wandering off for coffee.

The cat sits in a transparent, always-on-top window. Clicks pass straight through to whatever's underneath, except when your cursor is over the cat itself.

## Reactions

| You... | The cat... |
|---|---|
| type at a steady pace | kneads along |
| type furiously (8+ keys/s) | overheats |
| fling the cursor | hunts it, facing the direction of travel |
| scroll | bats at the "paper" |
| hover slowly over it | gets pets, purrs |
| grab it | mochi-stretches while you drag it anywhere |
| go idle for 3 min | curls up and sleeps |
| come back | yawn → stretch → back to work |

## Getting started

```bash
npm install
npm run dev      # Vite dev server + Electron with hot reload
```

Production build:

```bash
npm run build    # outputs installers to dist-electron/
```

### Platform notes

- **macOS** — global input hooks need Accessibility permission (System Settings → Privacy & Security → Accessibility). App-awareness needs Screen Recording permission.
- **Linux** — transparency requires a compositor (picom, KWin, Mutter all work).
- **Wayland** — global hooks via uiohook may be limited; X11 sessions work fully.

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
    animator.js  rAF canvas renderer, DPR-aware, resize-free draw loop
    sprites.js   sprite sheet frame map
assets/sprites/  sprite sheets (vite publicDir, served at web root)
```

Key design points:

- **Click-through windows**: `setIgnoreMouseEvents(true, { forward: true })` by default; a 16ms hit-test loop in the main process re-enables mouse events only while the cursor is inside the cat's reported bounds.
- **Drag**: the renderer reports the grab offset; the main process moves the window with the global cursor each tick, with a global-mouseup backstop so the window can never get stuck to the cursor.
- **Steady reactions**: IPC is throttled (mouse ~30Hz, typing rate every 250ms on change), thresholds use hysteresis bands so states don't flicker, and idle/sleep is driven by `powerMonitor` in the main process so it survives renderer reloads.
- **Crash-proofing**: single-instance lock, renderer crash auto-reload with loop detection, uncaught-exception guards, and a procedural fallback sprite sheet so the cat renders even with missing assets.

## Custom sprites

Drop your sheet at `assets/sprites/cat.png` — 32×32 frames, one row per state, in the order defined in `src/cat/sprites.js` (idle, walk, knead, overheat, sleep, wake, pet, hunt, drag, scroll, yawn). Adjust the frame counts in `sprites.js` to match.

## License

[MIT](LICENSE)
