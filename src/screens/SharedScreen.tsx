import { useMemo } from 'react'
import type { GauntletFight, PokemonEntry } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import type { Simulator } from '../engine/simulate.ts'
import { useBattleLog } from '../results/useBattleLog.ts'
import { DsShell } from '../components/DsShell.tsx'
import { ResultTop } from '../components/ResultTop.tsx'

interface Props {
  team: number[]
  mode: Mode
  byId: ReadonlyMap<number, PokemonEntry>
  gauntlet: readonly GauntletFight[]
  sim: Simulator
  onBuild(): void
}

/** What someone sees when they open a shared team: the team and record, a challenge, and a way to play. */
export function SharedScreen({ team, mode, byId, gauntlet, sim, onBuild }: Props) {
  const result = useMemo(() => sim.simulate(team), [sim, team])
  useBattleLog(result, gauntlet, byId)
  const entries = useMemo(() => team.map((id) => byId.get(id)!), [team, byId])
  const record = `${result.wins}–${result.losses}`

  return (
    <DsShell
      top={<ResultTop team={entries} wins={result.wins} losses={result.losses} mode={mode} />}
      bottom={
        <div className="challenge">
          <h2 className="h2 h2--center">{result.losses === 0 ? `Can you match ${record}?` : `Can you beat ${record}?`}</h2>
          <p className="challenge__blurb">Build an elite team of six to take on the 45-trainer gauntlet.</p>
          <button type="button" className="btn btn--primary" onClick={onBuild}>BUILD YOUR OWN TEAM</button>
        </div>
      }
    />
  )
}
