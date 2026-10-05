import { describe, expect, it } from 'vitest'
import { POKEMON_TYPES, type PokemonType } from '../data/types.ts'
import { damageMultiplier, effectiveness } from './typeChart.ts'

describe('effectiveness', () => {
  it.each([
    ['water', ['fire'], 2],
    ['fire', ['water'], 0.5],
    ['normal', ['normal'], 1],
    ['electric', ['water'], 2],
    ['fairy', ['dragon'], 2],
    ['steel', ['fairy'], 2],
    ['fire', ['steel'], 2],
    ['poison', ['steel'], 0],
  ] as [PokemonType, PokemonType[], number][])(
    'should give %s vs %j a multiplier of %d',
    (attacker, defender, expected) => {
      expect(effectiveness(attacker, defender)).toBe(expected)
    },
  )

  it.each([
    ['normal', ['ghost']],
    ['ghost', ['normal']],
    ['electric', ['ground']],
    ['fighting', ['ghost']],
    ['ground', ['flying']],
    ['psychic', ['dark']],
    ['dragon', ['fairy']],
    ['poison', ['steel']],
  ] as [PokemonType, PokemonType[]][])('should treat %s vs %j as an immunity', (a, d) => {
    expect(effectiveness(a, d)).toBe(0)
  })

  it('should multiply across both defender types', () => {
    expect(effectiveness('ice', ['dragon', 'flying'])).toBe(4)
    expect(effectiveness('rock', ['fire', 'flying'])).toBe(4)
    expect(effectiveness('fire', ['water', 'rock'])).toBe(0.25)
    expect(effectiveness('fire', ['grass', 'water'])).toBe(1)
  })

  it('should let an immunity override a weakness on the other type', () => {
    expect(effectiveness('ground', ['flying', 'fire'])).toBe(0)
    expect(effectiveness('electric', ['water', 'ground'])).toBe(0)
  })

  it('should cover all 324 attacker/defender pairs with a valid multiplier', () => {
    const valid = new Set([0, 0.5, 1, 2])
    for (const a of POKEMON_TYPES) for (const d of POKEMON_TYPES) {
      expect(valid.has(effectiveness(a, [d]))).toBe(true)
    }
  })

  it('should contain exactly 51 super-effective and 8 immune matchups (modern chart)', () => {
    let superEffective = 0
    let immune = 0
    for (const a of POKEMON_TYPES) for (const d of POKEMON_TYPES) {
      const m = effectiveness(a, [d])
      if (m === 2) superEffective++
      if (m === 0) immune++
    }
    expect([superEffective, immune]).toEqual([51, 8])
  })
})

describe('damageMultiplier', () => {
  it('should match the type chart for a defender with no immunity ability', () => {
    expect(damageMultiplier('ground', { types: ['electric', 'fire'] })).toBe(4)
    expect(damageMultiplier('ground', { types: ['electric', 'fire'], immunities: [] })).toBe(4)
  })

  it('should take nothing from a type the defender is immune to through an ability', () => {
    expect(damageMultiplier('ground', { types: ['electric', 'fire'], immunities: ['ground'] })).toBe(0)
  })

  it('should leave every other type alone', () => {
    const rotom = { types: ['electric', 'fire'] as PokemonType[], immunities: ['ground'] as PokemonType[] }
    for (const t of POKEMON_TYPES.filter((x) => x !== 'ground')) {
      expect(damageMultiplier(t, rotom)).toBe(effectiveness(t, rotom.types))
    }
  })
})
