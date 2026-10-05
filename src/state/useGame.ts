import { useCallback, useMemo, useRef, useState } from 'react'
import type { GauntletFight } from '../data/types.ts'
import { gameReducer, newGame, type GameAction, type GameState, type Mode } from '../engine/game.ts'
import type { Pool } from '../engine/pool.ts'
import { createSimulator, type Simulator } from '../engine/simulate.ts'
import { clearRun, loadRun, loadStats, recordResult, saveRun, type StatsSave } from './storage.ts'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface UseGame {
  state: GameState | null
  stats: StatsSave
  sim: Simulator
  start(mode: Mode): void
  dispatch(action: GameAction): void
  /** Drops the current run (finished or not) and returns to the start screen. */
  leave(): void
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31)

/** A saved run is only resumable if every drafted Pokémon still exists in the data. */
const resumable = (run: GameState | null, pool: Pool): GameState | null =>
  run && run.roster.every((id) => id === null || pool.byId.has(id)) ? run : null

export function useGame(
  pool: Pool,
  gauntlet: readonly GauntletFight[],
  storage: Store,
  makeSeed: () => number = randomSeed,
): UseGame {
  const sim = useMemo(() => createSimulator(pool.byId, gauntlet), [pool, gauntlet])
  const [state, setState] = useState<GameState | null>(() => resumable(loadRun(storage), pool))
  const [stats, setStats] = useState(() => loadStats(storage))
  const current = useRef(state)

  const commit = useCallback(
    (next: GameState | null) => {
      current.current = next
      setState(next)
      if (next) saveRun(storage, next)
      else clearRun(storage)
    },
    [storage],
  )

  const start = useCallback((mode: Mode) => commit(newGame(pool, makeSeed(), mode)), [commit, pool, makeSeed])

  const dispatch = useCallback(
    (action: GameAction) => {
      const before = current.current
      if (!before) return
      const next = gameReducer(before, action, pool)
      commit(next)
      if (next.phase === 'done') {
        const team = next.roster as number[]
        const { wins, losses } = sim.simulate(team)
        setStats(recordResult(storage, { date: new Date().toISOString(), mode: next.mode, team, wins, losses }))
      }
    },
    [commit, pool, sim, storage],
  )

  const leave = useCallback(() => commit(null), [commit])

  return { state, stats, sim, start, dispatch, leave }
}
