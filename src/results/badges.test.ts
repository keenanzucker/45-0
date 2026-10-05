import { describe, expect, it } from 'vitest'
import type { Gen, PokemonEntry, PokemonType } from '../data/types.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { teamBadges } from './badges.ts'

const GENS: Gen[] = [1, 2, 3, 4, 5, 6]
const TYPES: PokemonType[] = ['fire', 'water', 'grass', 'electric', 'ice', 'rock']

/** Six unremarkable Pokémon: mixed gens and types, one type each, middling stats, one legend and one mega. */
const plain = (over: (i: number) => Partial<PokemonEntry> = () => ({})): PokemonEntry[] =>
  Array.from({ length: 6 }, (_, i) =>
    mkEntry(i + 1, GENS[i], [TYPES[i]], {
      bst: 560,
      stats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 80 },
      category: i === 3 ? 'legend' : i === 5 ? 'mega' : 'normal',
      ...over(i),
    }),
  )

const ids = (team: PokemonEntry[], wins = 20) => teamBadges(team, wins).map((b) => b.id)

describe('teamBadges', () => {
  it('should award only World tour to a plain team spanning six generations', () => {
    expect(ids(plain(() => ({})))).toEqual(['world-tour'])
  })

  it('should call a team Mono-type when all six share a type', () => {
    expect(ids(plain((i) => ({ types: i === 2 ? ['fire', 'flying'] : ['fire'] })))).toContain('mono-type')
  })

  it('should not call a team Mono-type when one Pokémon lacks the shared type', () => {
    expect(ids(plain((i) => ({ types: i === 2 ? ['water'] : ['fire'] })))).not.toContain('mono-type')
  })

  it('should call a team One-region when all six are from one generation', () => {
    const found = ids(plain(() => ({ gen: 3 })))
    expect(found).toContain('one-region')
    expect(found).not.toContain('world-tour')
  })

  it('should call a team World tour when the six come from six generations', () => {
    const found = ids(plain())
    expect(found).toContain('world-tour')
    expect(found).not.toContain('one-region')
  })

  it('should give neither region badge to a team from some but not all generations', () => {
    const found = ids(plain((i) => ({ gen: i < 3 ? 1 : 2 })))
    expect(found).not.toContain('world-tour')
    expect(found).not.toContain('one-region')
  })

  it('should award No legends when none of the team is legend-class', () => {
    expect(ids(plain((i) => ({ category: i === 5 ? 'mega' : 'normal' })))).toContain('no-legends')
    expect(ids(plain())).not.toContain('no-legends')
  })

  it('should award Underdog for a below-average team that won at least 35', () => {
    const weak = plain(() => ({ bst: 500 }))
    expect(ids(weak, 35)).toContain('underdog')
    expect(ids(weak, 34)).not.toContain('underdog')
    expect(ids(plain(() => ({ bst: 580 })), 40)).not.toContain('underdog')
  })

  it('should award Dual-type only when every Pokémon has two types', () => {
    expect(ids(plain(() => ({ types: ['fire', 'flying'] })))).toContain('dual-type')
    expect(ids(plain((i) => ({ types: i === 0 ? ['fire'] : ['fire', 'flying'] })))).not.toContain('dual-type')
  })

  it('should award Speed demons for a very fast team', () => {
    const fast = (spe: number) => plain(() => ({ stats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe } }))
    expect(ids(fast(100))).toContain('speed-demons')
    expect(ids(fast(99))).not.toContain('speed-demons')
  })

  it('should award Wall of stats for a team with very high total stats', () => {
    expect(ids(plain(() => ({ bst: 600 })))).toContain('wall-of-stats')
    expect(ids(plain(() => ({ bst: 599 })))).not.toContain('wall-of-stats')
  })

  it('should show at most three badges, earliest first', () => {
    const everything = plain(() => ({
      gen: 3,
      types: ['dragon', 'flying'],
      category: 'normal',
      bst: 600,
      stats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 110 },
    }))
    expect(ids(everything, 45)).toEqual(['mono-type', 'one-region', 'no-legends'])
  })

  it('should describe each badge', () => {
    for (const b of teamBadges(plain(() => ({ gen: 3 })), 20)) {
      expect(b.emoji).not.toBe('')
      expect(b.label).not.toBe('')
      expect(b.hint).not.toBe('')
    }
  })

  it('should award nothing without a team', () => {
    expect(teamBadges([], 45)).toEqual([])
  })
})
