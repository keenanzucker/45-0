import { describe, expect, it } from 'vitest'
import { canPull, canReroll, currentResults, gameReducer, newGame, type GameState } from './game.ts'
import { buildPool } from './pool.ts'
import { seedRng } from './rng.ts'
import { drawSpin } from './spin.ts'
import { emptyRoster } from './slots.ts'
import { gridEntries, mkEntry } from './testUtils.ts'

const entries = [
  ...gridEntries([1, 2], ['fire', 'water', 'grass'], 8),
  mkEntry(1001, 1, ['fire'], { category: 'legend' }),
  mkEntry(1002, 1, ['fire'], { category: 'legend' }),
  mkEntry(1003, 1, ['fire'], { category: 'mega' }),
]
const pool = buildPool(entries)

const pull = (state: GameState) => gameReducer(state, { type: 'pull' }, pool)
/** A game with the first lever already pulled. */
const started = (seed: number, mode: 'normal' | 'hard' = 'normal') => pull(newGame(pool, seed, mode))

/** Plays the first selectable Pokémon of the current spin into its first legal slot, then pulls again. */
const autoPlace = (state: GameState): GameState => {
  const pick = currentResults(state, pool).find((r) => r.selectable)!.entry
  const slot = [0, 1, 2, 3, 4, 5].find((i) => {
    try {
      gameReducer(state, { type: 'place', pokemonId: pick.id, slotIndex: i }, pool)
      return true
    } catch {
      return false
    }
  })!
  const next = gameReducer(state, { type: 'place', pokemonId: pick.id, slotIndex: slot }, pool)
  return next.phase === 'done' ? next : pull(next)
}

describe('newGame', () => {
  it('should wait for the lever: empty roster, no spin yet, one reroll of each kind, the given mode', () => {
    const g = newGame(pool, 123, 'hard')
    expect(g.mode).toBe('hard')
    expect(g.phase).toBe('draft')
    expect(g.roster).toEqual([null, null, null, null, null, null])
    expect(g.rerollsLeft).toEqual({ era: 1, type: 1 })
    expect(g.spin).toBeNull()
    expect(canPull(g)).toBe(true)
  })

  it('should be deterministic per seed and survive a JSON round trip', () => {
    const a = newGame(pool, 99, 'normal')
    expect(newGame(pool, 99, 'normal')).toEqual(a)
    expect(JSON.parse(JSON.stringify(a))).toEqual(a)
  })
})

describe('pull', () => {
  it('should draw the first spin from the seed and advance the rng', () => {
    const g = newGame(pool, 7, 'normal')
    const next = pull(g)
    const [expected, rng] = drawSpin(pool, emptyRoster(), seedRng(7))
    expect(next.spin).toEqual(expected)
    expect(next.rng).toBe(rng)
    expect(canPull(next)).toBe(false)
  })

  it('should deal the same spins in both modes since the rules are identical', () => {
    expect(started(5, 'normal').spin).toEqual(started(5, 'hard').spin)
  })

  it('should survive a JSON round trip while waiting for a pull', () => {
    const g = autoPlaceToWaiting(started(4))
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })

  it('should not pull while a spin is showing', () => {
    expect(() => pull(started(1))).toThrow(/already showing/)
  })

  it('should not pull when the game is done', () => {
    let g = started(2)
    for (let i = 0; i < 6; i++) g = autoPlace(g)
    expect(canPull(g)).toBe(false)
    expect(() => pull(g)).toThrow(/done/)
  })
})

const autoPlaceToWaiting = (state: GameState): GameState => {
  const pick = currentResults(state, pool).find((r) => r.selectable)!.entry
  return gameReducer(state, { type: 'place', pokemonId: pick.id, slotIndex: 0 }, pool)
}

describe('place', () => {
  it('should fill the slot and leave the next spin waiting for the lever', () => {
    const g = started(1)
    const pick = currentResults(g, pool)[0].entry
    const next = gameReducer(g, { type: 'place', pokemonId: pick.id, slotIndex: 2 }, pool)
    expect(next.roster[2]).toBe(pick.id)
    expect(next.spin).toBeNull()
    expect(next.phase).toBe('draft')
    expect(next.rng).toBe(g.rng)
    expect(canPull(next)).toBe(true)
  })

  it('should draw the next spin only when pulled', () => {
    const waiting = autoPlaceToWaiting(started(1))
    const next = pull(waiting)
    expect(next.spin).not.toBeNull()
    expect(next.rng).not.toBe(waiting.rng)
  })

  it('should reject placing before the first pull', () => {
    expect(() => gameReducer(newGame(pool, 1, 'normal'), { type: 'place', pokemonId: 1, slotIndex: 0 }, pool)).toThrow(/pull/)
  })

  it('should reject a Pokémon that is not part of the current spin', () => {
    const g = started(1)
    const outside = pool.playable.find((e) => !currentResults(g, pool).some((r) => r.entry.id === e.id))!
    expect(() => gameReducer(g, { type: 'place', pokemonId: outside.id, slotIndex: 0 }, pool)).toThrow(/current spin/)
  })

  it('should reject a slot the Pokémon cannot fill', () => {
    const g: GameState = { ...started(1), spin: { era: 1, type: 'fire' } }
    expect(() => gameReducer(g, { type: 'place', pokemonId: 1001, slotIndex: 0 }, pool)).toThrow(/slot/)
    expect(gameReducer(g, { type: 'place', pokemonId: 1001, slotIndex: 4 }, pool).roster[4]).toBe(1001)
  })

  it('should finish after six placements with no spin left', () => {
    let g = started(2)
    for (let i = 0; i < 6; i++) g = autoPlace(g)
    expect(g.phase).toBe('done')
    expect(g.spin).toBeNull()
    expect(g.roster.every((id) => id !== null)).toBe(true)
  })

  it('should reject placements after the game is done', () => {
    let g = started(2)
    for (let i = 0; i < 6; i++) g = autoPlace(g)
    expect(() => gameReducer(g, { type: 'place', pokemonId: 1, slotIndex: 0 }, pool)).toThrow(/done/)
  })
})

describe('reroll', () => {
  it('should change only the era and consume the era reroll', () => {
    const g = started(3)
    const next = gameReducer(g, { type: 'reroll', kind: 'era' }, pool)
    expect(next.spin!.type).toBe(g.spin!.type)
    expect(next.spin!.era).not.toBe(g.spin!.era)
    expect(next.rerollsLeft).toEqual({ era: 0, type: 1 })
    expect(next.roster).toEqual(g.roster)
  })

  it('should change only the type and consume the type reroll', () => {
    const g = started(3)
    const next = gameReducer(g, { type: 'reroll', kind: 'type' }, pool)
    expect(next.spin!.era).toBe(g.spin!.era)
    expect(next.spin!.type).not.toBe(g.spin!.type)
    expect(next.rerollsLeft).toEqual({ era: 1, type: 0 })
  })

  it('should not allow a second reroll of the same kind', () => {
    const g = gameReducer(started(3), { type: 'reroll', kind: 'era' }, pool)
    expect(canReroll(g, pool, 'era')).toBe(false)
    expect(canReroll(g, pool, 'type')).toBe(true)
    expect(() => gameReducer(g, { type: 'reroll', kind: 'era' }, pool)).toThrow(/reroll/)
  })

  it('should not be possible while waiting for a pull', () => {
    const waiting = newGame(pool, 3, 'normal')
    expect(canReroll(waiting, pool, 'era')).toBe(false)
    expect(() => gameReducer(waiting, { type: 'reroll', kind: 'era' }, pool)).toThrow(/reroll/)
  })

  it('should not be possible when the game is done', () => {
    let g = started(2)
    for (let i = 0; i < 6; i++) g = autoPlace(g)
    expect(canReroll(g, pool, 'era')).toBe(false)
  })

  it('should not be possible when no alternative exists', () => {
    const tiny = buildPool(gridEntries([1], ['fire'], 8))
    const g = gameReducer(newGame(tiny, 1, 'normal'), { type: 'pull' }, tiny)
    expect(canReroll(g, tiny, 'era')).toBe(false)
    expect(canReroll(g, tiny, 'type')).toBe(false)
  })
})
