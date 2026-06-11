import Cat from './cat/Cat.jsx'
import Settings from './Settings.jsx'
import './App.css'

export default function App() {
  // Settings window uses hash routing from main.js
  const isSettings = window.location.hash === '#/settings'

  if (isSettings) {
    return <Settings />
  }

  return (
    <div className="app-root">
      <Cat />
    </div>
  )
}
