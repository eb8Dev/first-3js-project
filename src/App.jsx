import { useCallback, useState } from "react"
import ExperienceCanvas from "./components/ExperienceCanvas"
import "./App.css"

const initialStats = {
  speed: 0,
  lap: 0,
  camera: "Chase",
  loading: true,
  keys: {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    c: false,
    r: false,
  },
}

function App() {
  const [stats, setStats] = useState(initialStats)

  const handleStats = useCallback((nextStats) => {
    setStats(nextStats)
  }, [])

  return (
    <main className="experience">
      <ExperienceCanvas onStats={handleStats} />

      <section className="hud hud-top" aria-label="Race status">
        <div>
          <p className="eyebrow">Apex Rush GP</p>
          <h1>Nightfall Circuit</h1>
        </div>
        <div className="status-pill">{stats.loading ? "Loading model" : "Ready"}</div>
      </section>

      <section className="hud hud-bottom" aria-label="Driving telemetry">
        <div className="metric">
          <span>{stats.speed}</span>
          <small>km/h</small>
        </div>
        <div className="metric">
          <span>{stats.lap}</span>
          <small>laps</small>
        </div>
        <div className="metric">
          <span>{stats.camera}</span>
          <small>camera</small>
        </div>
      </section>

      <div className="control-strip" aria-label="Controls">
        <kbd className={stats.keys.w ? "is-active" : ""}>W</kbd>
        <kbd className={stats.keys.a ? "is-active" : ""}>A</kbd>
        <kbd className={stats.keys.s ? "is-active" : ""}>S</kbd>
        <kbd className={stats.keys.d ? "is-active" : ""}>D</kbd>
        <kbd className={stats.keys.shift ? "is-active boost-key" : "boost-key"}>Shift</kbd>
        <kbd className={stats.keys.c ? "is-active" : ""}>C</kbd>
        <kbd className={stats.keys.r ? "is-active" : ""}>R</kbd>
      </div>
    </main>
  )
}

export default App
