import { POKEMON_TYPES, type PokemonEntry, type PokemonType } from '../data/types.ts'
import type { FightOutcome } from '../engine/simulate.ts'
import { damageMultiplier, effectiveness } from '../engine/typeChart.ts'

export interface DefenseRow {
  type: PokemonType
  /** Damage multiplier of this attacking type against each team member, in team order. */
  multipliers: number[]
  weak: number
  /** Members that resist or are immune. */
  resist: number
}

/** Every attacking type against the team, most exposed first (ties: fewer resistances). */
export function defenseMatrix(team: readonly PokemonEntry[]): DefenseRow[] {
  return POKEMON_TYPES.map((type) => {
    const multipliers = team.map((e) => damageMultiplier(type, e))
    return {
      type,
      multipliers,
      weak: multipliers.filter((m) => m > 1).length,
      resist: multipliers.filter((m) => m < 1).length,
    }
  }).sort((a, b) => b.weak - a.weak || a.resist - b.resist)
}

export interface CoverageRow {
  /** The defending type. */
  type: PokemonType
  /** Each team member's best multiplier from its own (STAB) types against a pure defender of this type. */
  multipliers: number[]
  /** Members that hit it super-effectively. */
  coveredBy: number
  covered: boolean
}

/**
 * Which defending types the team hits super-effectively with its own types (the only attacks the
 * simulation uses), and by whom. Least covered types first.
 */
export function coverage(team: readonly PokemonEntry[]): CoverageRow[] {
  return POKEMON_TYPES.map((type) => {
    const multipliers = team.map((e) => Math.max(...e.types.map((t) => effectiveness(t, [type]))))
    const coveredBy = multipliers.filter((m) => m > 1).length
    return { type, multipliers, coveredBy, covered: coveredBy > 0 }
  }).sort((a, b) => a.coveredBy - b.coveredBy)
}

export interface Contribution {
  entry: PokemonEntry
  /** Fights this Pokémon was sent out in. */
  fights: number
  knockouts: number
  faints: number
  /** Opponent hp removed and own hp lost, both in whole-Pokémon units. */
  dealt: number
  taken: number
  /** dealt - taken */
  net: number
}

export interface Contributions {
  stats: Contribution[]
  carry: Contribution | null
  /** Null when it would be the same Pokémon as the carry. */
  weakLink: Contribution | null
}

/** Per-Pokémon totals from every duel; the carry has the biggest net hp swing, the weak link the smallest. */
export function teamContributions(team: readonly PokemonEntry[], fights: readonly FightOutcome[]): Contributions {
  const stats: Contribution[] = team.map((entry) => ({
    entry,
    fights: 0,
    knockouts: 0,
    faints: 0,
    dealt: 0,
    taken: 0,
    net: 0,
  }))
  const byId = new Map(stats.map((s) => [s.entry.id, s]))

  for (const fight of fights) {
    const seen = new Set<number>()
    for (const d of fight.trace.duels) {
      const s = byId.get(d.mine)
      if (!s) continue
      seen.add(d.mine)
      s.dealt += d.hpLostOpponent
      s.taken += d.hpLostMine
      if (d.fainted === 'mine') s.faints++
      else s.knockouts++
    }
    for (const id of seen) byId.get(id)!.fights++
  }
  for (const s of stats) s.net = s.dealt - s.taken

  let carry: Contribution | null = null
  let weak: Contribution | null = null
  for (const s of stats) {
    if (!carry || s.net > carry.net) carry = s
    if (!weak || s.net <= weak.net) weak = s
  }
  return { stats, carry, weakLink: weak === carry ? null : weak }
}
