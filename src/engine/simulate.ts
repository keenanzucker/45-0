import type { GauntletFight, PokemonEntry, PokemonType } from '../data/types.ts'
import {
  DEFAULT_PARAMS,
  marginToWinProb,
  pairRates,
  runBattle,
  scaleStats,
  type Combatant,
  type RateAdjust,
  type SimParams,
} from './battle.ts'
import { damageMultiplier } from './typeChart.ts'

/** One duel of a team battle: the Pokémon sent out on each side and how it went. */
export interface DuelTrace {
  /** Pokémon ids. */
  mine: number
  opponent: number
  /** Best STAB effectiveness multiplier of each side's attacker against the other. */
  myEffectiveness: number
  opponentEffectiveness: number
  /** Speed after opponent normalization; the faster side gets a damage bonus. */
  mySpeed: number
  opponentSpeed: number
  /** Fraction of the defender's hp removed per attack, speed bonus included. */
  myRate: number
  opponentRate: number
  /** Hp fraction (of a full-hp Pokémon) each side lost in this duel. */
  hpLostMine: number
  hpLostOpponent: number
  fainted: 'mine' | 'opponent'
}

export interface TraceMon {
  id: number
  /** Hp fraction left when the battle ended. */
  hpLeft: number
}

export interface OpponentTraceMon extends TraceMon {
  /** Stat total after normalization to the fight's target. */
  scaledBst: number
}

/** Everything that decided a fight: the won flag is `mine` having any hp left, i.e. `margin > 0`. */
export interface FightTrace {
  /** Average stat total the opponent team was scaled to. */
  targetBst: number
  opponents: OpponentTraceMon[]
  mine: TraceMon[]
  duels: DuelTrace[]
}

export interface FightOutcome {
  fightId: string
  winProb: number
  /** Positive when won; see `runBattle`. */
  margin: number
  won: boolean
  trace: FightTrace
}

export interface LossDriver {
  type: PokemonType
  /** Share of the super-effective damage taken in lost fights. */
  share: number
}

export interface SimulationResult {
  wins: number
  losses: number
  fights: FightOutcome[]
  lossDrivers: LossDriver[]
}

export interface Simulator {
  simulate(teamIds: readonly number[]): SimulationResult
  /** Win count only; allocation-light for large calibration runs. */
  wins(teamIds: readonly number[]): number
  /**
   * Replays every fight, in gauntlet order, and says which were won. `adjust` rewrites the STAB
   * multipliers of my attacks (`mine`) and theirs (`theirs`) to ask "what if" questions.
   */
  fightsWon(teamIds: readonly number[], adjust?: RateAdjust): boolean[]
  /** Smooth "expected wins": the sum of per-fight win probabilities. Used to rank partial teams. */
  value(teamIds: readonly number[]): number
}

const MAX_DRIVERS = 3

const statSum = (e: Pick<PokemonEntry, 'stats'>) =>
  e.stats.hp + e.stats.atk + e.stats.def + e.stats.spa + e.stats.spd + e.stats.spe

/**
 * Builds a simulator for a fixed gauntlet. Opponent teams are rescaled so their
 * average BST equals `oppTargetBst` (plus `championBonus` for champions and
 * `teamSizeBonus` per missing member); species, types and stat shape are preserved. Per-Pokémon matchup tables are built lazily.
 */
export function createSimulator(
  byId: ReadonlyMap<number, PokemonEntry>,
  gauntlet: readonly GauntletFight[],
  params: SimParams = DEFAULT_PARAMS,
): Simulator {
  const slots: Combatant[] = []
  const fights = gauntlet.map((f) => {
    const team = f.team.map((id) => {
      const e = byId.get(id)
      if (!e) throw new Error(`unknown Pokémon ${id} in fight ${f.id}`)
      return e
    })
    const target =
      params.oppTargetBst *
      (f.tier === 'champion' ? 1 + params.championBonus : 1) *
      (1 + params.teamSizeBonus * (6 - team.length))
    const factor = target / (team.reduce((s, e) => s + statSum(e), 0) / team.length)
    const start = slots.length
    for (const e of team) slots.push({ types: e.types, immunities: e.immunities, stats: scaleStats(e.stats, factor) })
    return { id: f.id, start, count: team.length, target, opponentIds: team.map((e) => e.id) }
  })

  const tables = new Map<number, { ab: Float64Array; ba: Float64Array; entry: PokemonEntry }>()
  const tableFor = (id: number) => {
    let t = tables.get(id)
    if (!t) {
      const entry = byId.get(id)
      if (!entry) throw new Error(`unknown Pokémon ${id}`)
      const ab = new Float64Array(slots.length)
      const ba = new Float64Array(slots.length)
      slots.forEach((slot, k) => {
        const r = pairRates(entry, slot, params)
        ab[k] = r.ab
        ba[k] = r.ba
      })
      t = { ab, ba, entry }
      tables.set(id, t)
    }
    return t
  }

  const prepare = (teamIds: readonly number[]) => {
    if (teamIds.length === 0) throw new Error('team must have at least one Pokémon')
    const t = teamIds.map(tableFor)
    return { rowsAB: t.map((x) => x.ab), rowsBA: t.map((x) => x.ba), entries: t.map((x) => x.entry) }
  }

  return {
    wins(teamIds) {
      const { rowsAB, rowsBA } = prepare(teamIds)
      let wins = 0
      for (const f of fights) if (runBattle(teamIds.length, f.count, rowsAB, rowsBA, f.start).won) wins++
      return wins
    },

    fightsWon(teamIds, adjust) {
      if (!adjust) {
        const { rowsAB, rowsBA } = prepare(teamIds)
        return fights.map((f) => runBattle(teamIds.length, f.count, rowsAB, rowsBA, f.start).won)
      }
      const { entries } = prepare(teamIds)
      const rows = entries.map((entry) => {
        const ab = new Float64Array(slots.length)
        const ba = new Float64Array(slots.length)
        slots.forEach((slot, k) => {
          const r = pairRates(entry, slot, params, adjust)
          ab[k] = r.ab
          ba[k] = r.ba
        })
        return { ab, ba }
      })
      const rowsAB = rows.map((r) => r.ab)
      const rowsBA = rows.map((r) => r.ba)
      return fights.map((f) => runBattle(teamIds.length, f.count, rowsAB, rowsBA, f.start).won)
    },

    value(teamIds) {
      const { rowsAB, rowsBA } = prepare(teamIds)
      let total = 0
      for (const f of fights) {
        total += marginToWinProb(runBattle(teamIds.length, f.count, rowsAB, rowsBA, f.start).margin, params)
      }
      return total
    },

    simulate(teamIds) {
      const { rowsAB, rowsBA, entries } = prepare(teamIds)
      const seDamage = new Map<PokemonType, number>()
      const outcomes: FightOutcome[] = []

      for (const f of fights) {
        const duels: DuelTrace[] = []
        const fightSeDamage = new Map<PokemonType, number>()
        const r = runBattle(
          teamIds.length,
          f.count,
          rowsAB,
          rowsBA,
          f.start,
          (mine, opp, toMine, toOpp, mineFainted) => {
            const attacker = slots[f.start + opp]
            const defender = entries[mine]
            let bestType = attacker.types[0]
            let bestMult = -1
            for (const t of attacker.types) {
              const mult = damageMultiplier(t, defender)
              if (mult > bestMult) {
                bestMult = mult
                bestType = t
              }
            }
            if (bestMult >= 2) fightSeDamage.set(bestType, (fightSeDamage.get(bestType) ?? 0) + toMine)
            duels.push({
              mine: defender.id,
              opponent: f.opponentIds[opp],
              myEffectiveness: Math.max(...defender.types.map((t) => damageMultiplier(t, attacker))),
              opponentEffectiveness: bestMult,
              mySpeed: defender.stats.spe,
              opponentSpeed: attacker.stats.spe,
              myRate: rowsAB[mine][f.start + opp],
              opponentRate: rowsBA[mine][f.start + opp],
              hpLostMine: toMine,
              hpLostOpponent: toOpp,
              fainted: mineFainted ? 'mine' : 'opponent',
            })
          },
        )
        outcomes.push({
          fightId: f.id,
          winProb: marginToWinProb(r.margin, params),
          margin: r.margin,
          won: r.won,
          trace: {
            targetBst: f.target,
            opponents: f.opponentIds.map((id, j) => ({
              id,
              hpLeft: Math.max(0, r.oppHp[j]),
              scaledBst: statSum({ stats: slots[f.start + j].stats }),
            })),
            mine: entries.map((e, i) => ({ id: e.id, hpLeft: Math.max(0, r.mineHp[i]) })),
            duels,
          },
        })
        if (r.won) continue
        for (const [type, dmg] of fightSeDamage) seDamage.set(type, (seDamage.get(type) ?? 0) + dmg)
      }

      const total = [...seDamage.values()].reduce((a, b) => a + b, 0)
      const lossDrivers = [...seDamage]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_DRIVERS)
        .map(([type, dmg]) => ({ type, share: dmg / total }))
      const wins = outcomes.filter((o) => o.won).length
      return { wins, losses: outcomes.length - wins, fights: outcomes, lossDrivers }
    },
  }
}
