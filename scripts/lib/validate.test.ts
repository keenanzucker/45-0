import { describe, expect, it } from 'vitest'
import type { PokemonEntry } from '../../src/data/types.ts'
import { summarizePool, validatePool } from './validate.ts'

const entry = (over: Partial<PokemonEntry> = {}): PokemonEntry => ({
  id: 6,
  slug: 'charizard',
  name: 'Charizard',
  speciesId: 6,
  gen: 1,
  types: ['fire', 'flying'],
  stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
  bst: 534,
  category: 'normal',
  isStarter: true,
  isFinal: true,
  sprite: '/sprites/6.png',
  ...over,
})

const exists = () => true

describe('validatePool', () => {
  it('should report no issues for a valid pool', () => {
    expect(validatePool([entry()], { spriteExists: exists })).toEqual([])
  })

  it('should flag duplicate ids', () => {
    const issues = validatePool([entry(), entry()], { spriteExists: exists })
    expect(issues.map((i) => i.message)).toContain('duplicate id 6')
  })

  it('should flag a bst that does not match the stats', () => {
    const issues = validatePool([entry({ bst: 500 })], { spriteExists: exists })
    expect(issues[0].message).toMatch(/bst/)
  })

  it('should flag non-positive stats', () => {
    const stats = { hp: 0, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 }
    const issues = validatePool([entry({ stats, bst: 456 })], { spriteExists: exists })
    expect(issues.map((i) => i.message).join()).toMatch(/hp/)
  })

  it('should flag entries with zero or three types', () => {
    expect(validatePool([entry({ types: [] })], { spriteExists: exists })[0].message).toMatch(
      /types/,
    )
    expect(
      validatePool([entry({ types: ['fire', 'water', 'grass'] })], { spriteExists: exists })[0]
        .message,
    ).toMatch(/types/)
  })

  it('should flag repeated types on one Pokémon', () => {
    const issues = validatePool([entry({ types: ['fire', 'fire'] })], { spriteExists: exists })
    expect(issues[0].message).toMatch(/types/)
  })

  it('should flag missing sprite files', () => {
    const issues = validatePool([entry()], { spriteExists: () => false })
    expect(issues[0].message).toMatch(/sprite/)
  })
})

describe('summarizePool', () => {
  const pool = [
    entry({ id: 1, gen: 1, types: ['fire'] }),
    entry({ id: 2, gen: 1, types: ['fire', 'flying'] }),
    entry({ id: 3, gen: 2, types: ['water'], category: 'mega' }),
  ]

  it('should count entries by category and generation', () => {
    const s = summarizePool(pool, 2)
    expect(s.total).toBe(3)
    expect(s.byCategory).toEqual({ normal: 2, legend: 0, mega: 1 })
    expect(s.byGen[1]).toBe(2)
    expect(s.byGen[2]).toBe(1)
  })

  it('should count legend-class entries by kind', () => {
    const withLegends = [
      ...pool,
      entry({ id: 4, category: 'legend', legendKind: 'box-art' }),
      entry({ id: 5, category: 'legend', legendKind: 'mythical' }),
      entry({ id: 6, category: 'legend', legendKind: 'mythical' }),
    ]
    expect(summarizePool(withLegends, 2).byLegendKind).toEqual({
      'box-art': 1,
      legendary: 0,
      mythical: 2,
      paradox: 0,
      'ultra-beast': 0,
    })
  })

  it('should count a dual-type Pokémon under both of its types when sizing combos', () => {
    const s = summarizePool(pool, 2)
    expect(s.comboCounts.get('1:fire')).toBe(2)
    expect(s.comboCounts.get('1:flying')).toBe(1)
  })

  it('should count combos that meet the minimum number of choices', () => {
    expect(summarizePool(pool, 2).playableCombos).toBe(1)
    expect(summarizePool(pool, 1).playableCombos).toBe(3)
  })
})
