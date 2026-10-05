import { describe, expect, it } from 'vitest'
import type { Category, Gen, GauntletFight, PokemonEntry, PokemonType } from '../../src/data/types.ts'
import { DEFAULT_PARAMS } from '../../src/engine/battle.ts'
import { buildPool } from '../../src/engine/pool.ts'
import { createSimulator } from '../../src/engine/simulate.ts'
import { mkEntry } from '../../src/engine/testUtils.ts'
import { bestPossibleTeam, bstDraft, greedyDraft, randomDraft } from './draft.ts'
import { currentResults, gameReducer, newGame } from '../../src/engine/game.ts'

const TYPES: PokemonType[] = ['fire', 'water', 'grass']
const GENS: Gen[] = [1, 2, 3]

/** 3 eras x 3 types x 6 normals with varied stats, plus a few specials. */
function makeEntries(): PokemonEntry[] {
  const out: PokemonEntry[] = []
  let id = 1
  for (const gen of GENS) for (const type of TYPES) {
    for (let k = 0; k < 6; k++) {
      const v = 40 + ((id * 7) % 11) * 8
      out.push(mkEntry(id, gen, [type], { stats: { hp: v, atk: v, def: v, spa: v, spd: v, spe: v }, bst: 6 * v }))
      id++
    }
  }
  const special = (cat: Category, gen: Gen, type: PokemonType, v: number) =>
    out.push(
      mkEntry(id, gen, [type], { category: cat, stats: { hp: v, atk: v, def: v, spa: v, spd: v, spe: v }, bst: 6 * v }),
    ) && id++
  special('legend', 1, 'fire', 150)
  special('legend', 2, 'water', 150)
  special('legend', 1, 'grass', 140)
  special('legend', 3, 'water', 140)
  special('mega', 2, 'fire', 160)
  special('mega', 3, 'grass', 160)
  return out
}

const entries = makeEntries()
const pool = buildPool(entries)
const gauntlet: GauntletFight[] = [
  [1, 7, 13],
  [20, 25, 30, 35],
  [40, 45, 50],
  [3, 30, 50, 12],
].map((team, i) => ({
  id: `f${i}`,
  gen: 1 as const,
  region: 'T',
  name: `f${i}`,
  tier: i === 3 ? ('champion' as const) : ('e4' as const),
  game: 't',
  team,
}))
const sim = createSimulator(pool.byId, gauntlet, DEFAULT_PARAMS)

const speciesOf = (ids: (number | null)[]) => ids.map((id) => pool.byId.get(id!)!.speciesId)
const cats = (ids: (number | null)[]) => ids.map((id) => pool.byId.get(id!)!.category)

describe('randomDraft', () => {
  it('should finish with six distinct species and respect the legend and mega caps', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const g = randomDraft(pool, seed)
      expect(g.phase).toBe('done')
      expect(new Set(speciesOf(g.roster)).size).toBe(6)
      expect(cats(g.roster).filter((c) => c === 'legend').length).toBeLessThanOrEqual(2)
      expect(cats(g.roster).filter((c) => c === 'mega').length).toBeLessThanOrEqual(1)
    }
  })

  it('should be deterministic per seed and vary across seeds', () => {
    expect(randomDraft(pool, 5).roster).toEqual(randomDraft(pool, 5).roster)
    expect(randomDraft(pool, 5).roster).not.toEqual(randomDraft(pool, 6).roster)
  })
})

describe('greedyDraft', () => {
  it('should finish with a valid roster and be deterministic per seed', () => {
    const a = greedyDraft(pool, sim, 3)
    expect(a.phase).toBe('done')
    expect(new Set(speciesOf(a.roster)).size).toBe(6)
    expect(greedyDraft(pool, sim, 3).roster).toEqual(a.roster)
  })

  it('should beat the average random draft on expected wins', () => {
    const greedy = Array.from({ length: 10 }, (_, i) => sim.value(greedyDraft(pool, sim, i + 1).roster as number[]))
    const random = Array.from({ length: 10 }, (_, i) => sim.value(randomDraft(pool, i + 1).roster as number[]))
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(greedy)).toBeGreaterThan(mean(random))
  })

  it('should use rerolls when they help (at most one of each kind)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = greedyDraft(pool, sim, seed, { rerollGain: 0 })
      expect(g.rerollsLeft.era).toBeGreaterThanOrEqual(0)
      expect(g.rerollsLeft.type).toBeGreaterThanOrEqual(0)
    }
    const used = Array.from({ length: 10 }, (_, i) => greedyDraft(pool, sim, i + 1, { rerollGain: 0 }))
      .filter((g) => g.rerollsLeft.era < 1 || g.rerollsLeft.type < 1).length
    expect(used).toBeGreaterThan(0)
  })
})

describe('bstDraft', () => {
  it('should finish with a valid roster and be deterministic per seed', () => {
    const g = bstDraft(pool, 4)
    expect(g.phase).toBe('done')
    expect(new Set(speciesOf(g.roster)).size).toBe(6)
    expect(bstDraft(pool, 4).roster).toEqual(g.roster)
  })

  it('should take the highest-BST selectable Pokémon on the first spin', () => {
    const first = gameReducer(newGame(pool, 7, 'normal'), { type: 'pull' }, pool)
    const top = currentResults(first, pool)
      .filter((r) => r.selectable)
      .reduce((a, b) => (b.entry.bst > a.entry.bst ? b : a)).entry
    expect(bstDraft(pool, 7).roster).toContain(top.id)
  })

  it('should never use rerolls', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(bstDraft(pool, seed).rerollsLeft).toEqual({ era: 1, type: 1 })
    }
  })
})

describe('bestPossibleTeam', () => {
  const best = bestPossibleTeam(pool, sim, { restarts: 4, seed: 1 })

  it('should return a legal team: six distinct species with at most two legends and one mega', () => {
    expect(best.team).toHaveLength(6)
    expect(new Set(speciesOf(best.team)).size).toBe(6)
    expect(cats(best.team).filter((c) => c === 'legend').length).toBeLessThanOrEqual(2)
    expect(cats(best.team).filter((c) => c === 'mega').length).toBeLessThanOrEqual(1)
  })

  it('should be at least as good as every greedy draft and report its value', () => {
    expect(best.value).toBeCloseTo(sim.value(best.team))
    for (let seed = 1; seed <= 5; seed++) {
      expect(best.value).toBeGreaterThanOrEqual(sim.value(greedyDraft(pool, sim, seed).roster as number[]) - 1e-9)
    }
  })
})
