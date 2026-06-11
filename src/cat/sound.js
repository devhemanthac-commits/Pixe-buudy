// Procedural sound synthesis using the Web Audio API.
// No external deps or audio files to bundle — every sound is computed on the fly.
// The AudioContext is lazy-created so it doesn't block startup.

let _ctx = null

function audio() {
  if (!_ctx) _ctx = new AudioContext()
  return _ctx
}

// AudioContext starts suspended if created before a user gesture; resume() is
// called before every play so the first gesture that reaches us unblocks it.
function resume() {
  const c = audio()
  if (c.state === 'suspended') c.resume()
}

// ── Meow: short sine sweep up then down ("mew") ───────────────────────────
export function playMeow() {
  resume()
  const c = audio(), now = c.currentTime
  const g = c.createGain()
  g.gain.setValueAtTime(0.18, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
  g.connect(c.destination)
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(680, now)
  o.frequency.exponentialRampToValueAtTime(1280, now + 0.07)
  o.frequency.exponentialRampToValueAtTime(620, now + 0.4)
  o.connect(g)
  o.start(now)
  o.stop(now + 0.41)
}

// ── Purr: layered sawtooth flutter at 26 / 52 / 78 Hz ────────────────────
export function playPurr() {
  resume()
  const c = audio(), now = c.currentTime
  const master = c.createGain()
  master.gain.setValueAtTime(0, now)
  master.gain.linearRampToValueAtTime(0.07, now + 0.3)
  master.gain.setValueAtTime(0.07, now + 0.8)
  master.gain.exponentialRampToValueAtTime(0.001, now + 1.1)
  master.connect(c.destination)
  ;[26, 52, 78].forEach((hz, i) => {
    const sub = c.createGain()
    sub.gain.value = i === 0 ? 1 : 0.38 - i * 0.1
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz
    o.connect(sub)
    sub.connect(master)
    o.start(now)
    o.stop(now + 1.15)
  })
}

// ── Steam hiss: band-pass white noise burst ───────────────────────────────
export function playSteam() {
  resume()
  const c = audio(), now = c.currentTime
  const sr = c.sampleRate
  const buf = c.createBuffer(1, Math.round(sr * 0.22), sr)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const flt = c.createBiquadFilter()
  flt.type = 'bandpass'
  flt.frequency.value = 3800
  flt.Q.value = 1.4
  const g = c.createGain()
  g.gain.setValueAtTime(0.09, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
  g.connect(c.destination)
  src.connect(flt)
  flt.connect(g)
  src.start(now)
}

// ── Landing thud: sine pitch-dive (mochi hits the ground) ────────────────
export function playBounce() {
  resume()
  const c = audio(), now = c.currentTime
  const g = c.createGain()
  g.gain.setValueAtTime(0.24, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
  g.connect(c.destination)
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(210, now)
  o.frequency.exponentialRampToValueAtTime(48, now + 0.28)
  o.connect(g)
  o.start(now)
  o.stop(now + 0.29)
}

// ── Level-up: C5→E5→G5→C6 triangle arpeggio ─────────────────────────────
export function playLevelUp() {
  resume()
  const c = audio(), now = c.currentTime
  ;[523, 659, 784, 1047].forEach((hz, i) => {
    const t = now + i * 0.1
    const g = c.createGain()
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26)
    g.connect(c.destination)
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = hz
    o.connect(g)
    o.start(t)
    o.stop(t + 0.27)
  })
}

// ── Wake yawn: gentle rising wobble ──────────────────────────────────────
export function playWake() {
  resume()
  const c = audio(), now = c.currentTime
  const g = c.createGain()
  g.gain.setValueAtTime(0.09, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.48)
  g.connect(c.destination)
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(360, now)
  o.frequency.linearRampToValueAtTime(560, now + 0.2)
  o.frequency.linearRampToValueAtTime(420, now + 0.48)
  o.connect(g)
  o.start(now)
  o.stop(now + 0.49)
}

// ── Stretch reminder: ascending three-note bell chime ────────────────────
export function playChime() {
  resume()
  const c = audio(), now = c.currentTime
  ;[880, 1100, 1320].forEach((hz, i) => {
    const t = now + i * 0.14
    const g = c.createGain()
    g.gain.setValueAtTime(0.15, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.75)
    g.connect(c.destination)
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = hz
    o.connect(g)
    o.start(t)
    o.stop(t + 0.76)
  })
}
