/**
 * Draft strategies used only by the calibration tooling: a random player, a
 * greedy bot with a reroll heuristic, and a hill-climb that finds the best
 * team ignoring the spinners (an upper bound on what is achievable).
 */
import type { PokemonEntry } from '../../src/data/types.ts'
import { canPull, canReroll, currentResults, gameReducer, newGame, type GameState, type Mode } from '../../src/engine/game.ts'
import { spinResults, type Pool, type Spin } from '../../src/engine/pool.ts'
import { nextFloat, pickOne, seedRng } from '../../src/engine/rng.ts'
import type { Simulator } from '../../src/engine/simulate.ts'
import { rerollOptions } from '../../src/engine/spin.ts'
import { SLOTS, placementSlots, type Roster } from '../../src/engine/slots.ts'

const filled = (roster: Roster): number[] => roster.filter((id): id is number => id !== null)

/** Pulls the lever when the next spin is waiting for it. */
const ensureSpin = (state: GameState, pool: Pool): GameState =>
  canPull(state) ? gameReducer(state, { type: 'pull' }, pool) : state

/** Random legal picks and slots, rerolling with 30% probability while rerolls remain. */
export function randomDraft(pool: Pool, seed: number, mode: Mode = 'normal'): GameState {
  let state = newGame(pool, seed, mode)
  let rng = seedRng(seed * 7919 + 1)
  while (state.phase === 'draft') {
    state = ensureSpin(state, pool)
    let roll: number
    ;[roll, rng] = nextFloat(rng)
    for (const kind of ['era', 'type'] as const) {
      if (roll < 0.3 && canReroll(state, pool, kind)) {
        state = gameReducer(state, { type: 'reroll', kind }, pool)
        break
      }
    }
    const selectable = currentResults(state, pool).filter((r) => r.selectable)
    let pick: { entry: PokemonEntry }
    ;[pick, rng] = pickOne(rng, selectable)
    let slotIndex: number
    ;[slotIndex, rng] = pickOne(rng, placementSlots(state.roster, pick.entry, pool.byId))
    state = gameReducer(state, { type: 'place', pokemonId: pick.entry.id, slotIndex }, pool)
  }
  return state
}

export interface GreedyOptions {
  /**
   * A reroll is taken when its expected gain in expected wins exceeds
   * `rerollGain * stepsLeft / 6`, so the bar drops toward the end of the draft.
   */
  rerollGain?: number
}

/** Normals go to a normal slot first, keeping special slots free for specials. */
function choosePlacement(roster: Roster, entry: PokemonEntry, pool: Pool): number {
  const slots = placementSlots(roster, entry, pool.byId)
  return slots.find((i) => SLOTS[i] === 'normal') ?? slots[0]
}

export function greedyDraft(
  pool: Pool,
  sim: Simulator,
  seed: number,
  options: GreedyOptions = {},
): GameState {
  const rerollGain = options.rerollGain ?? 0.8
  let state = newGame(pool, seed, 'normal')

  const best = (spin: Spin, roster: Roster) => {
    const have = filled(roster)
    let top: { entry: PokemonEntry; value: number } | null = null
    for (const r of spinResults(pool, spin, roster)) {
      if (!r.selectable) continue
      const value = sim.value([...have, r.entry.id])
      if (!top || value > top.value) top = { entry: r.entry, value }
    }
    return top
  }

  while (state.phase === 'draft') {
    state = ensureSpin(state, pool)
    const roster = state.roster
    const stepsLeft = roster.filter((id) => id === null).length
    const current = best(state.spin!, roster)!

    let bestKind: 'era' | 'type' | null = null
    let bestGain = -Infinity
    for (const kind of ['era', 'type'] as const) {
      if (!canReroll(state, pool, kind)) continue
      const options = rerollOptions(pool, roster, state.spin!, kind)
      const values = options.map((o) => best(o, roster)?.value ?? current.value)
      const gain = values.reduce((a, b) => a + b, 0) / values.length - current.value
      if (gain > bestGain) {
        bestGain = gain
        bestKind = kind
      }
    }
    if (bestKind && bestGain > (rerollGain * stepsLeft) / 6) {
      state = gameReducer(state, { type: 'reroll', kind: bestKind }, pool)
      continue
    }

    const slotIndex = choosePlacement(roster, current.entry, pool)
    state = gameReducer(state, { type: 'place', pokemonId: current.entry.id, slotIndex }, pool)
  }
  return state
}

/**
 * A casual-but-sensible player: always takes the highest-BST selectable Pokémon
 * (what the normal-mode sort invites) and never rerolls.
 */
export function bstDraft(pool: Pool, seed: number): GameState {
  let state = newGame(pool, seed, 'normal')
  while (state.phase === 'draft') {
    state = ensureSpin(state, pool)
    const top = currentResults(state, pool)
      .filter((r) => r.selectable)
      .reduce((a, b) => (b.entry.bst > a.entry.bst ? b : a)).entry
    const slotIndex = choosePlacement(state.roster, top, pool)
    state = gameReducer(state, { type: 'place', pokemonId: top.id, slotIndex }, pool)
  }
  return state
}

export interface BestTeam {
  team: number[]
  value: number
}

/** Hill-climbs over every legal team in the pool, ignoring the spinners. */
export function bestPossibleTeam(
  pool: Pool,
  sim: Simulator,
  options: { restarts?: number; seed?: number } = {},
): BestTeam {
  const { restarts = 3, seed = 1 } = options
  const candidates = pool.playable

  /** Distinct species, and no more of a special category than there are slots for it. */
  const legal = (others: PokemonEntry[], e: PokemonEntry) =>
    !others.some((o) => o.speciesId === e.speciesId) &&
    (e.category === 'normal' ||
      others.filter((o) => o.category === e.category).length < SLOTS.filter((s) => s === e.category).length)

  const valueOf = (team: PokemonEntry[]) => sim.value(team.map((e) => e.id))

  const climb = (start: PokemonEntry[]): BestTeam => {
    let team = start
    let value = valueOf(team)
    let improved = true
    while (improved) {
      improved = false
      for (let pos = 0; pos < team.length; pos++) {
        const others = team.filter((_, i) => i !== pos)
        let bestE = team[pos]
        let bestV = value
        for (const e of candidates) {
          if (e === team[pos] || !legal(others, e)) continue
          const v = valueOf([...others.slice(0, pos), e, ...others.slice(pos)])
          if (v > bestV + 1e-12) {
            bestV = v
            bestE = e
          }
        }
        if (bestE !== team[pos]) {
          team = [...others.slice(0, pos), bestE, ...others.slice(pos)]
          value = bestV
          improved = true
        }
      }
    }
    return { team: team.map((e) => e.id), value }
  }

  // Start 0: greedy build over the whole pool. Further starts: random legal teams.
  const greedyStart: PokemonEntry[] = []
  while (greedyStart.length < 6) {
    let top: PokemonEntry | null = null
    let topV = -Infinity
    for (const e of candidates) {
      if (!legal(greedyStart, e)) continue
      const v = valueOf([...greedyStart, e])
      if (v > topV) {
        topV = v
        top = e
      }
    }
    greedyStart.push(top!)
  }

  let result = climb(greedyStart)
  let rng = seedRng(seed)
  for (let r = 0; r < restarts; r++) {
    const start: PokemonEntry[] = []
    while (start.length < 6) {
      let e: PokemonEntry
      ;[e, rng] = pickOne(rng, candidates)
      if (legal(start, e)) start.push(e)
    }
    const attempt = climb(start)
    if (attempt.value > result.value) result = attempt
  }
  return { team: result.team, value: result.value }
}
