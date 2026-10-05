import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { POKEMON_TYPES, type PokemonEntry } from './types.ts'

const entries = JSON.parse(readFileSync('public/data/pokemon.json', 'utf8')) as PokemonEntry[]
const named = (name: string) => entries.find((e) => e.name === name)

describe('generated Pokémon data', () => {
  it('should offer Palafin in both its base and Hero forms as one species', () => {
    const base = named('Palafin')
    const hero = named('Palafin (Hero)')
    expect(base).toBeDefined()
    expect(hero).toBeDefined()
    expect(hero!.speciesId).toBe(base!.speciesId)
    expect(hero!.id).toBeGreaterThanOrEqual(10000)
  })

  it('should make Palafin (Hero) the stronger form with real stats and a sprite', () => {
    const base = named('Palafin')!
    const hero = named('Palafin (Hero)')!
    expect(hero.types).toEqual(['water'])
    expect(hero.bst).toBe(650)
    expect(hero.bst).toBeGreaterThan(base.bst)
    expect(hero.stats.atk).toBeGreaterThan(base.stats.atk)
    expect(hero.category).toBe('normal')
    expect(hero.isFinal).toBe(true)
    expect(hero.sprite).toBe(`/sprites/${hero.id}.png`)
  })

  it('should have no two playable entries of a species with identical types, stats and category', () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const e of entries.filter((x) => x.isFinal)) {
      const key = JSON.stringify([e.speciesId, e.types, e.stats, e.category])
      const first = seen.get(key)
      if (first) dupes.push(`${e.name} duplicates ${first}`)
      else seen.set(key, e.name)
    }
    expect(dupes).toEqual([])
  })

  it('should name a species\' only Mega without a form word', () => {
    expect(named('Mega Tatsugiri')).toBeDefined()
    expect(named('Mega Meowstic')).toBeDefined()
    expect(named('Mega Meowstic (Female)')).toBeUndefined()
    expect(named('Toxtricity (Low Key)')).toBeUndefined()
    expect(named('Meowstic (Female)')).toBeUndefined()
  })

  it.each(['Pikachu', 'Eevee', 'Magikarp'])('should let you pick %s even though it can evolve', (name) => {
    const entry = named(name)
    expect(entry).toBeDefined()
    expect(entry!.isFinal).toBe(true)
    expect(entry!.category).toBe('normal')
  })

  it('should still offer the evolutions alongside the fan favorites', () => {
    for (const name of ['Raichu', 'Gyarados', 'Vaporeon', 'Umbreon']) expect(named(name)?.isFinal).toBe(true)
  })

  it('should keep every other unevolved Pokémon out of the pool', () => {
    for (const name of ['Pichu', 'Charmander', 'Togepi', 'Riolu', 'Munchlax']) expect(named(name)?.isFinal).toBe(false)
  })

  describe('ability immunities', () => {
    it('should give guaranteed immunities to Pokémon whose every ability grants one', () => {
      expect(named('Rotom (Heat)')!.immunities).toEqual(['ground'])
      expect(named('Rotom')!.immunities).toEqual(['ground'])
      expect(named('Flygon')!.immunities).toEqual(['ground'])
      expect(named('Hydreigon')!.immunities).toEqual(['ground'])
      expect(named('Zeraora')!.immunities).toEqual(['electric'])
    })

    it('should not give an immunity to Pokémon that only might have the ability', () => {
      for (const name of ['Weezing', 'Vaporeon', 'Arcanine', 'Pikachu', 'Azumarill', 'Gengar']) {
        expect(named(name)!.immunities).toBeUndefined()
      }
    })

    it('should only record real types, one per Pokémon, and only on playable entries', () => {
      const withImmunity = entries.filter((e) => e.immunities)
      expect(withImmunity.length).toBeGreaterThanOrEqual(30)
      for (const e of withImmunity) {
        expect(e.immunities).toHaveLength(1)
        expect(POKEMON_TYPES).toContain(e.immunities![0])
      }
    })
  })
})
