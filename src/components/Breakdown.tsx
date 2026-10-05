import { useMemo } from 'react'
import type { GauntletFight, PokemonEntry } from '../data/types.ts'
import type { SimulationResult, Simulator } from '../engine/simulate.ts'
import { explainLosses } from '../results/lossSummary.ts'
import { Analysis } from './Analysis.tsx'
import { FightsList } from './FightsList.tsx'

interface Props {
  team: readonly PokemonEntry[]
  result: SimulationResult
  sim: Simulator
  byId: ReadonlyMap<number, PokemonEntry>
  gauntlet: readonly GauntletFight[]
}

/** The full analysis of a run: carry and weak link, why it lost, type charts, and every fight. */
export function Breakdown({ team, result, sim, byId, gauntlet }: Props) {
  const hurt = useMemo(() => explainLosses({ team, result, sim, byId }), [team, result, sim, byId])
  return (
    <>
      <Analysis team={team} fights={result.fights} hurt={hurt} />
      <FightsList gauntlet={gauntlet} outcomes={result.fights} byId={byId} />
    </>
  )
}
