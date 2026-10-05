import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PokemonEntry } from '../data/types.ts'
import { canPull, canReroll, currentResults, gameReducer, newGame, type GameState } from './game.ts'
import { buildPool } from './pool.ts'
import { nextFloat, pickOne, seedRng } from './rng.ts'
import { MIN_CHOICES } from './spin.ts'
import { placementSlots } from './slots.ts'

const entries = JSON.parse(readFileSync('public/data/pokemon.json', 'utf8')) as PokemonEntry[]
const pool = buildPool(entries)

interface PlayResult {
  state: GameState
  spinSizes: number[]
  firstSpin: { era: number; type: string }
}

/** Plays a full game with random (but legal) picks, slots and rerolls. */
function playRandomGame(seed: number): PlayResult {
  let state = newGame(pool, seed, seed % 2 === 0 ? 'normal' : 'hard')
  let rng = seedRng(seed * 7919 + 1)
  const spinSizes: number[] = []
  let firstSpin: { era: number; type: string } | null = null

  while (state.phase === 'draft') {
    if (canPull(state)) state = gameReducer(state, { type: 'pull' }, pool)
    firstSpin ??= { ...state.spin! }
    let roll: number
    ;[roll, rng] = nextFloat(rng)
    for (const kind of ['era', 'type'] as const) {
      if (roll < 0.3 && canReroll(state, pool, kind)) {
        state = gameReducer(state, { type: 'reroll', kind }, pool)
        break
      }
    }

    const selectable = currentResults(state, pool).filter((r) => r.selectable)
    spinSizes.push(new Set(selectable.map((r) => r.entry.speciesId)).size)
    let pick: { entry: PokemonEntry }
    ;[pick, rng] = pickOne(rng, selectable)
    let slotIndex: number
    ;[slotIndex, rng] = pickOne(rng, placementSlots(state.roster, pick.entry, pool.byId))
    state = gameReducer(state, { type: 'place', pokemonId: pick.entry.id, slotIndex }, pool)
  }
  return { state, spinSizes, firstSpin: firstSpin! }
}

describe('random full games on the real pool', () => {
  const games = Array.from({ length: 300 }, (_, i) => playRandomGame(i + 1))

  it('should always finish with six placed, distinct species', () => {
    for (const { state } of games) {
      expect(state.phase).toBe('done')
      const species = state.roster.map((id) => pool.byId.get(id!)!.speciesId)
      expect(new Set(species).size).toBe(6)
    }
  })

  it('should never place more than two legend-class Pokémon or one mega', () => {
    for (const { state } of games) {
      const cats = state.roster.map((id) => pool.byId.get(id!)!.category)
      expect(cats.filter((c) => c === 'legend').length).toBeLessThanOrEqual(2)
      expect(cats.filter((c) => c === 'mega').length).toBeLessThanOrEqual(1)
    }
  })

  it('should only draft playable (final) Pokémon', () => {
    for (const { state } of games) {
      for (const id of state.roster) expect(pool.byId.get(id!)!.isFinal).toBe(true)
    }
  })

  it('should always offer at least MIN_CHOICES selectable species on every spin', () => {
    const all = games.flatMap((g) => g.spinSizes)
    expect(all.length).toBeGreaterThanOrEqual(300 * 6)
    expect(Math.min(...all)).toBeGreaterThanOrEqual(MIN_CHOICES)
  })

  it('should deal a spread of eras and types across seeds', () => {
    const eras = new Set(games.map((g) => g.firstSpin.era))
    const types = new Set(games.map((g) => g.firstSpin.type))
    expect(eras.size).toBe(9)
    expect(types.size).toBeGreaterThanOrEqual(16)
  })
})
