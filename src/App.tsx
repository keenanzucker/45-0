import { useEffect, useState } from 'react'
import { DsShell } from './components/DsShell.tsx'
import { loadData, type GameData } from './data/load.ts'
import { Game } from './screens/Game.tsx'

const sharedCode = () => new URLSearchParams(window.location.search).get('t')

const clearSharedCode = () => window.history.replaceState(null, '', window.location.pathname)

export default function App() {
  const [data, setData] = useState<GameData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData().then(setData, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error) {
    return <DsShell top={<div className="hero"><h1 className="hero__logo">45-0</h1></div>} bottom={<p className="fine">Could not load game data. {error}</p>} />
  }
  if (!data) {
    return <DsShell top={<div className="hero"><h1 className="hero__logo">45-0</h1></div>} bottom={<p className="fine">Loading…</p>} />
  }
  return <Game data={data} storage={window.localStorage} sharedCode={sharedCode()} onLeaveShared={clearSharedCode} />
}
