import { POKEMON_TYPES, type PokemonEntry, type PokemonType } from '../data/types.ts'
import type { RateAdjust } from '../engine/battle.ts'
import type { SimulationResult, Simulator } from '../engine/simulate.ts'
import { coverage } from './analysis.ts'

const capitalize = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`

interface Args {
  team: readonly PokemonEntry[]
  result: SimulationResult
  sim: Pick<Simulator, 'fightsWon'>
  byId: ReadonlyMap<number, PokemonEntry>
}

/** Losses a replay turns into wins. */
const flipped = (lost: readonly boolean[], replay: readonly boolean[]) =>
  lost.reduce((n, isLoss, i) => n + (isLoss && replay[i] ? 1 : 0), 0)

/**
 * One line on what cost the team its losses. Two what-if replays decide whether defense or offense
 * mattered more: opponents never hitting super-effectively, versus the team hitting every type it
 * can't otherwise hit super-effectively. Ties go to the defense line.
 */
export function explainLosses({ team, result, sim, byId }: Args): string {
  if (result.losses === 0) return 'Flawless. Nothing got through.'

  const ids = team.map((e) => e.id)
  const lost = result.fights.map((f) => !f.won)
  const gaps = new Set<PokemonType>(coverage(team).filter((c) => !c.covered).map((c) => c.type))

  const defenseAdjust: RateAdjust = { theirs: (best) => Math.min(best, 1) }
  const offenseAdjust: RateAdjust = {
    mine: (best, defender) => (defender.types.some((t) => gaps.has(t)) ? Math.max(best, 2) : best),
  }
  const defenseFlips = flipped(lost, sim.fightsWon(ids, defenseAdjust))
  const offenseFlips = gaps.size > 0 ? flipped(lost, sim.fightsWon(ids, offenseAdjust)) : 0

  if (offenseFlips > defenseFlips) {
    const typeCounts = new Map<PokemonType, number>()
    let lossesEndingOnAGap = 0
    for (const fight of result.fights) {
      if (fight.won) continue
      const standing = new Set<PokemonType>()
      for (const o of fight.trace.opponents) {
        if (o.hpLeft <= 0) continue
        for (const t of byId.get(o.id)?.types ?? []) if (gaps.has(t)) standing.add(t)
      }
      if (standing.size > 0) lossesEndingOnAGap++
      for (const t of standing) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
    }
    if (lossesEndingOnAGap > 0) {
      const types = [...typeCounts]
        .sort((a, b) => b[1] - a[1] || POKEMON_TYPES.indexOf(a[0]) - POKEMON_TYPES.indexOf(b[0]))
        .map(([t]) => capitalize(t))
        .join(', ')
      return (
        `In ${lossesEndingOnAGap} of ${result.losses} ${result.losses === 1 ? 'loss' : 'losses'}, ` +
        `the opponent left standing was a type your team can't hit super-effectively (${types}).`
      )
    }
  }

  if (result.lossDrivers.length > 0) {
    const attackers = result.lossDrivers.map((d) => `${capitalize(d.type)} (${Math.round(d.share * 100)}%)`).join(', ')
    return `Most of your losses came from ${attackers} attackers.`
  }
  return 'Your team was simply outclassed.'
}
