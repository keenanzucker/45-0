import type { PokemonType, Stats } from '../data/types.ts'
import { damageMultiplier } from './typeChart.ts'

/** Tunable constants of the simulation; defaults are set by calibration (scripts/calibrate.ts). */
export interface SimParams {
  /**
   * Exponent applied to the stat ratio (attack / defense / hp) before type effects.
   * Below 1 it compresses raw-stat differences so type coverage matters as much as BST.
   */
  statExponent: number
  /** Multiplier for a same-type attack. */
  stabWeight: number
  /** Power of the generic neutral coverage move a Pokémon falls back to when its STAB is resisted or immune. */
  coverageFloor: number
  /** Max fractional damage bonus/penalty from being faster/slower (0..1). */
  speedWeight: number
  /** How quickly the speed effect saturates as the speed ratio grows. */
  speedSlope: number
  /** Margin (in "Pokémon worth of hp") at which win probability reaches ~73%. */
  marginScale: number
  /** Opponent teams are rescaled so their average BST equals this. */
  oppTargetBst: number
  /** Extra fraction added to the BST target for champion fights. */
  championBonus: number
  /** Extra fraction added to the BST target per opposing Pokémon fewer than six. */
  teamSizeBonus: number
}

/**
 * Calibrated with scripts/calibrate.ts (see docs/calibration.md). `oppTargetBst` is a
 * model constant, not a literal BST: with the stat exponent below 1, opponents must be
 * scaled well above real-world team BSTs to hit the difficulty targets.
 */
export const DEFAULT_PARAMS: SimParams = {
  statExponent: 0.5,
  stabWeight: 1.5,
  coverageFloor: 0.6,
  speedWeight: 0.25,
  speedSlope: 1,
  marginScale: 0.5,
  oppTargetBst: 610,
  championBonus: 0.05,
  teamSizeBonus: 0.15,
}

export interface Combatant {
  types: readonly PokemonType[]
  /** Types it takes no damage from through an ability. */
  immunities?: readonly PokemonType[]
  stats: Stats
}

/** Rewrites a best-STAB multiplier for what-if replays (for example "everything is at least neutral"). */
export type StabAdjust = (best: number, defender: Combatant) => number

/** What-if adjustments for the two directions of a matchup. */
export interface RateAdjust {
  mine?: StabAdjust
  theirs?: StabAdjust
}

/**
 * Fraction of the defender's hp removed per attack (up to a constant that cancels out
 * of every duel): the better of its STAB attack and a neutral coverage move, times
 * the best of physical and special attack over the matching defense, divided by hp
 * (that stat ratio raised to `statExponent`).
 */
export function attackRate(
  attacker: Combatant,
  defender: Combatant,
  p: SimParams,
  adjustStab?: StabAdjust,
): number {
  const rawStab = Math.max(...attacker.types.map((t) => damageMultiplier(t, defender)))
  const bestStab = adjustStab ? adjustStab(rawStab, defender) : rawStab
  const eff = Math.max(p.stabWeight * bestStab, p.coverageFloor)
  const { atk, spa } = attacker.stats
  const { def, spd, hp } = defender.stats
  return eff * Math.pow(Math.max(atk / def, spa / spd) / hp, p.statExponent)
}

/** Attack rates of `a` on `b` and `b` on `a`, with speed turned into a bounded damage bonus/penalty. */
export function pairRates(
  a: Combatant,
  b: Combatant,
  p: SimParams,
  adjust?: RateAdjust,
): { ab: number; ba: number } {
  const eps = p.speedWeight * Math.tanh(p.speedSlope * Math.log(a.stats.spe / b.stats.spe))
  return {
    ab: attackRate(a, b, p, adjust?.mine) * (1 + eps),
    ba: attackRate(b, a, p, adjust?.theirs) * (1 - eps),
  }
}

export interface BattleResult {
  won: boolean
  /** My remaining hp (in Pokémon units) if I won, minus the opponent's remaining hp if I lost. */
  margin: number
  /** Remaining hp fraction of each of my Pokémon (0 = fainted). */
  mineHp: Float64Array
  /** Remaining hp fraction of each opponent Pokémon. */
  oppHp: Float64Array
}

/**
 * Called once per duel with my mon index, the opponent index, hp lost by my mon and hp
 * lost by theirs, and whether my mon was the one that fainted.
 */
export type DuelListener = (
  mine: number,
  opp: number,
  toMine: number,
  toOpp: number,
  mineFainted: boolean,
) => void

/**
 * Sequential team battle. Opponents come out in order; I always send the alive
 * Pokémon with the best duel ratio against the current one. Damage carries over.
 * `abRows[i][off + j]` / `baRows[i][off + j]` are the per-attack hp fractions of
 * my mon i on opponent j and of j on i.
 */
export function runBattle(
  n: number,
  m: number,
  abRows: readonly Float64Array[],
  baRows: readonly Float64Array[],
  off: number,
  onDuel?: DuelListener,
): BattleResult {
  const hMine = new Float64Array(n).fill(1)
  const hOpp = new Float64Array(m).fill(1)
  let mineAlive = n

  for (let j = 0; j < m && mineAlive > 0; j++) {
    while (hOpp[j] > 0 && mineAlive > 0) {
      let best = -1
      let bestScore = -Infinity
      for (let i = 0; i < n; i++) {
        if (hMine[i] <= 0) continue
        const score = (hMine[i] * abRows[i][off + j]) / (hOpp[j] * baRows[i][off + j])
        if (score > bestScore) {
          bestScore = score
          best = i
        }
      }
      const ab = abRows[best][off + j]
      const ba = baRows[best][off + j]
      const tI = hOpp[j] / ab
      const tJ = hMine[best] / ba
      if (tI < tJ) {
        const lost = ba * tI
        const dealt = hOpp[j]
        hMine[best] -= lost
        hOpp[j] = 0
        onDuel?.(best, j, lost, dealt, false)
      } else {
        const lost = hMine[best]
        const dealt = ab * tJ
        hOpp[j] -= dealt
        hMine[best] = 0
        mineAlive--
        onDuel?.(best, j, lost, dealt, true)
      }
    }
  }

  let mine = 0
  for (let i = 0; i < n; i++) mine += Math.max(0, hMine[i])
  let opp = 0
  for (let j = 0; j < m; j++) opp += Math.max(0, hOpp[j])
  const hp = { mineHp: hMine, oppHp: hOpp }
  return mineAlive > 0 ? { won: true, margin: mine, ...hp } : { won: false, margin: -opp, ...hp }
}

export const marginToWinProb = (margin: number, p: SimParams): number =>
  1 / (1 + Math.exp(-margin / p.marginScale))

export const scaleStats = (s: Stats, factor: number): Stats => ({
  hp: s.hp * factor,
  atk: s.atk * factor,
  def: s.def * factor,
  spa: s.spa * factor,
  spd: s.spd * factor,
  spe: s.spe * factor,
})
