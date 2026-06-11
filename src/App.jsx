import { useEffect } from 'react'
import Cat from './cat/Cat.jsx'
import './App.css'

export default function App() {
  // Detect if we're in settings view (hash routing)
  const isSettings = window.location.hash === '#/settings'

  if (isSettings) {
    return <SettingsView />
  }

  return (
    <div className="app-root">
      <Cat />
    </div>
  )
}

function SettingsView() {
  return (
    <div className="settings-root">
      <h2>Pixe-buudy Settings</h2>
      <p>Settings coming in Phase 7.</p>
    </div>
  )
}
