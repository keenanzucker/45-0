import { useEffect } from 'react'
import type { GauntletFight, PokemonEntry } from '../data/types.ts'
import type { SimulationResult } from '../engine/simulate.ts'
import { isDebugLogging, logBattles } from './battleLog.ts'

/** Logs how each fight was decided to the console when the page was opened with `?debug`. */
export function useBattleLog(
  result: SimulationResult,
  gauntlet: readonly GauntletFight[],
  byId: ReadonlyMap<number, PokemonEntry>,
): void {
  useEffect(() => {
    if (isDebugLogging(window.location.search)) logBattles(result, gauntlet, byId)
  }, [result, gauntlet, byId])
}
