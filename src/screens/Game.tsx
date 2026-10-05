import { useMemo, useState } from 'react'
import type { GameData } from '../data/load.ts'
import { buildPool } from '../engine/pool.ts'
import { decodeTeam } from '../results/share.ts'
import type { HistoryEntry } from '../state/storage.ts'
import { useGame } from '../state/useGame.ts'
import { DraftScreen } from './DraftScreen.tsx'
import { ResultsScreen } from './ResultsScreen.tsx'
import { SharedScreen } from './SharedScreen.tsx'
import { RecordsScreen } from './RecordsScreen.tsx'
import { StartScreen } from './StartScreen.tsx'

interface Props {
  data: GameData
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  /** Value of the `?t=` query parameter, when opening a shared team. */
  sharedCode?: string | null
  makeSeed?: () => number
  onLeaveShared?: () => void
}

export function Game({ data, storage, sharedCode = null, makeSeed, onLeaveShared }: Props) {
  const pool = useMemo(() => buildPool(data.entries), [data.entries])
  const game = useGame(pool, data.gauntlet, storage, makeSeed)

  const [viewingRecords, setViewingRecords] = useState(false)
  const [viewingRun, setViewingRun] = useState<HistoryEntry | null>(null)
  const [shared, setShared] = useState(() => {
    const decoded = sharedCode ? decodeTeam(sharedCode) : null
    return decoded && decoded.ids.every((id) => pool.byId.has(id)) ? decoded : null
  })

  if (shared) {
    return (
      <SharedScreen
        team={shared.ids}
        mode={shared.mode}
        byId={pool.byId}
        gauntlet={data.gauntlet}
        sim={game.sim}
        onBuild={() => {
          setShared(null)
          onLeaveShared?.()
        }}
      />
    )
  }
  const { state } = game
  if (!state) {
    if (viewingRun) {
      return (
        <ResultsScreen
          team={viewingRun.team}
          mode={viewingRun.mode}
          byId={pool.byId}
          gauntlet={data.gauntlet}
          sim={game.sim}
          onBack={() => setViewingRun(null)}
        />
      )
    }
    if (viewingRecords) {
      return <RecordsScreen stats={game.stats} byId={pool.byId} onBack={() => setViewingRecords(false)} onViewRun={setViewingRun} />
    }
    return <StartScreen entries={pool.playable} onStart={game.start} onRecords={() => setViewingRecords(true)} />
  }
  if (state.phase === 'done') {
    return (
      <ResultsScreen
        team={state.roster as number[]}
        mode={state.mode}
        byId={pool.byId}
        gauntlet={data.gauntlet}
        sim={game.sim}
        onPlayAgain={game.leave}
      />
    )
  }
  return <DraftScreen state={state} pool={pool} dispatch={game.dispatch} onQuit={game.leave} />
}
