import { useEffect, useState, useRef } from 'react'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  buildFilter,
  COLOR_PRESETS,
  MAX_SHEET_BYTES,
} from './settings.js'

const SEND_THROTTLE_MS = 100

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [fileError, setFileError] = useState(null)
  const fileInputRef = useRef(null)
  // Leading+trailing throttle for IPC sends: slider drags fire at ~60Hz
  // and each send carries the whole settings object (incl. a possibly
  // large custom-sheet dataURL)
  const sendRef = useRef({ timer: null, lastSent: 0, latest: null })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let stored = null
      try {
        stored = await window.electronAPI?.getStore('settings', null)
      } catch {}
      if (!cancelled) {
        setSettings(normalizeSettings(stored))
        setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
      if (sendRef.current.timer) clearTimeout(sendRef.current.timer)
    }
  }, [])

  const update = (patch) => {
    const next = normalizeSettings({ ...settings, ...patch })
    setSettings(next)

    const s = sendRef.current
    s.latest = next
    const sendNow = () => {
      s.lastSent = Date.now()
      s.timer = null
      window.electronAPI?.updateSettings(s.latest)
    }
    const elapsed = Date.now() - s.lastSent
    if (elapsed >= SEND_THROTTLE_MS) {
      sendNow()
    } else if (!s.timer) {
      s.timer = setTimeout(sendNow, SEND_THROTTLE_MS - elapsed)
    }
  }

  const onFile = (e) => {
    setFileError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFileError('Pick an image file (PNG recommended).')
      return
    }
    if (file.size > MAX_SHEET_BYTES) {
      setFileError(`Sheet too large — max ${Math.round(MAX_SHEET_BYTES / 1024 / 1024)}MB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => update({ customSheet: reader.result })
    reader.onerror = () => setFileError('Could not read that file.')
    reader.readAsDataURL(file)
  }

  const clearCustomSheet = () => {
    update({ customSheet: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const resetAll = () => {
    update({ ...DEFAULT_SETTINGS })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!loaded) return <div className="settings-root">Loading…</div>

  const previewFilter = buildFilter(settings)

  return (
    <div className="settings-root">
      <h2>Pixe-buudy Settings</h2>

      <section>
        <label className="field">
          <span>Buddy name</span>
          <input
            type="text"
            maxLength={24}
            value={settings.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
      </section>

      <section>
        <h3>Size</h3>
        <label className="field slider-field">
          <input
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={settings.scale}
            onChange={(e) => update({ scale: Number(e.target.value) })}
          />
          <span className="value">{settings.scale}×</span>
        </label>
      </section>

      <section>
        <h3>Color</h3>
        <div className="swatches">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.label}
              className={
                settings.hue === p.hue && settings.saturate === p.saturate
                  ? 'swatch active'
                  : 'swatch'
              }
              style={{ filter: buildFilter({ ...DEFAULT_SETTINGS, hue: p.hue, saturate: p.saturate }) }}
              onClick={() => update({ hue: p.hue, saturate: p.saturate })}
              title={p.label}
            >
              🐱
            </button>
          ))}
        </div>
        <label className="field slider-field">
          <span>Hue</span>
          <input
            type="range"
            min={0}
            max={360}
            value={settings.hue}
            onChange={(e) => update({ hue: Number(e.target.value) })}
          />
          <span className="value">{settings.hue}°</span>
        </label>
        <label className="field slider-field">
          <span>Saturation</span>
          <input
            type="range"
            min={0}
            max={200}
            value={settings.saturate}
            onChange={(e) => update({ saturate: Number(e.target.value) })}
          />
          <span className="value">{settings.saturate}%</span>
        </label>
        <label className="field slider-field">
          <span>Brightness</span>
          <input
            type="range"
            min={50}
            max={150}
            value={settings.brightness}
            onChange={(e) => update({ brightness: Number(e.target.value) })}
          />
          <span className="value">{settings.brightness}%</span>
        </label>
        <div className="preview" style={{ filter: previewFilter }}>
          🐱 live tint preview
        </div>
      </section>

      <section>
        <h3>Custom buddy</h3>
        <p className="hint">
          Import a sprite sheet: one row per animation (idle, walk, knead, overheat, sleep,
          wake, pet, hunt, drag, scroll, yawn, stretch, sit, dance, play). Missing rows fall
          back to idle.
        </p>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFile} />
        {fileError && <p className="error">{fileError}</p>}
        {settings.customSheet && (
          <div className="custom-sheet-row">
            <img className="sheet-thumb" src={settings.customSheet} alt="custom sheet" />
            <button onClick={clearCustomSheet}>Use default cat</button>
          </div>
        )}
        <div className="frame-size">
          <label className="field">
            <span>Frame W</span>
            <input
              type="number"
              min={8}
              max={128}
              value={settings.frameW}
              onChange={(e) => update({ frameW: Number(e.target.value) })}
              disabled={!settings.customSheet}
            />
          </label>
          <label className="field">
            <span>Frame H</span>
            <input
              type="number"
              min={8}
              max={128}
              value={settings.frameH}
              onChange={(e) => update({ frameH: Number(e.target.value) })}
              disabled={!settings.customSheet}
            />
          </label>
        </div>
      </section>

      <section>
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => update({ sound: e.target.checked })}
          />
          <span>Sounds (meow, purr)</span>
        </label>
      </section>

      <section className="actions">
        <button onClick={resetAll}>Reset to defaults</button>
        <button className="danger" onClick={() => window.electronAPI?.quitApp()}>
          Quit Pixe-buudy
        </button>
      </section>
    </div>
  )
}
