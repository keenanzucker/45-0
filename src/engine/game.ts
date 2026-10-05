import { drawReroll, drawSpin, rerollOptions } from './spin.ts'
import { spinResults, type Pool, type Spin, type SpinEntry } from './pool.ts'
import { seedRng } from './rng.ts'
import { emptyRoster, isFull, placeInRoster, type Roster } from './slots.ts'

export type Mode = 'normal' | 'hard'

/** Plain JSON-safe data, so a run can be saved to localStorage and resumed. */
export interface GameState {
  mode: Mode
  seed: number
  /** PRNG state; advances on every spin and reroll. */
  rng: number
  roster: Roster
  /**
   * The era/type being offered. Null while the next spin is waiting for the lever
   * (`canPull`) and once the roster is full.
   */
  spin: Spin | null
  rerollsLeft: { era: number; type: number }
  phase: 'draft' | 'done'
}

export type GameAction =
  | { type: 'pull' }
  | { type: 'place'; pokemonId: number; slotIndex: number }
  | { type: 'reroll'; kind: 'era' | 'type' }

/** A fresh game waiting for the first lever pull. */
export function newGame(_pool: Pool, seed: number, mode: Mode): GameState {
  return {
    mode,
    seed,
    rng: seedRng(seed),
    roster: emptyRoster(),
    spin: null,
    rerollsLeft: { era: 1, type: 1 },
    phase: 'draft',
  }
}

/** True while the next spin is waiting for the lever. */
export const canPull = (state: GameState): boolean => state.phase === 'draft' && state.spin === null

export const currentResults = (state: GameState, pool: Pool): SpinEntry[] =>
  state.spin ? spinResults(pool, state.spin, state.roster) : []

export function canReroll(state: GameState, pool: Pool, kind: 'era' | 'type'): boolean {
  if (state.phase !== 'draft' || !state.spin || state.rerollsLeft[kind] < 1) return false
  return rerollOptions(pool, state.roster, state.spin, kind).length > 0
}

/** Throws on invalid actions; the UI is expected to only offer legal ones. */
export function gameReducer(state: GameState, action: GameAction, pool: Pool): GameState {
  if (state.phase === 'done') throw new Error('the game is done')

  if (action.type === 'pull') {
    if (state.spin) throw new Error('a spin is already showing')
    const [spin, rng] = drawSpin(pool, state.roster, state.rng)
    return { ...state, spin, rng }
  }

  if (action.type === 'reroll') {
    if (!canReroll(state, pool, action.kind)) throw new Error(`cannot reroll ${action.kind}`)
    const [spin, rng] = drawReroll(pool, state.roster, state.spin!, action.kind, state.rng)!
    return {
      ...state,
      spin,
      rng,
      rerollsLeft: { ...state.rerollsLeft, [action.kind]: state.rerollsLeft[action.kind] - 1 },
    }
  }

  if (!state.spin) throw new Error('pull the lever first')
  const offered = currentResults(state, pool).find((r) => r.entry.id === action.pokemonId)
  if (!offered) throw new Error(`pokemon ${action.pokemonId} is not part of the current spin`)
  if (!offered.selectable) throw new Error(`${offered.entry.name} is not selectable`)

  const roster = placeInRoster(state.roster, action.slotIndex, offered.entry, pool.byId)
  return { ...state, roster, spin: null, phase: isFull(roster) ? 'done' : 'draft' }
}
