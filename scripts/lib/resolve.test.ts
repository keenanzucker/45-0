import { describe, expect, it } from 'vitest'
import type { PokemonEntry } from '../../src/data/types.ts'
import { resolveDittoBaseMon, resolvePokemonDbMon, sameTeam } from './resolve.ts'

const e = (
  id: number,
  slug: string,
  speciesId: number,
  category: PokemonEntry['category'] = 'normal',
): PokemonEntry => ({
  id,
  slug,
  name: slug,
  speciesId,
  gen: 1,
  types: ['normal'],
  stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
  bst: 6,
  category,
  isStarter: false,
  isFinal: true,
  sprite: `/sprites/${id}.png`,
})

const pool = [
  e(38, 'ninetales', 38),
  e(10110, 'ninetales-alola', 38),
  e(555, 'darmanitan-standard', 555),
  e(10174, 'darmanitan-galar-standard', 555),
  e(128, 'tauros', 128),
  e(10250, 'tauros-paldea-combat-breed', 128),
  e(10251, 'tauros-paldea-blaze-breed', 128),
  e(282, 'gardevoir', 282),
  e(10051, 'gardevoir-mega', 282, 'mega'),
  e(6, 'charizard', 6),
  e(10034, 'charizard-mega-x', 6, 'mega'),
  e(10035, 'charizard-mega-y', 6, 'mega'),
  e(678, 'meowstic-male', 678),
  e(745, 'lycanroc-midday', 745),
  e(10126, 'lycanroc-midnight', 745),
  e(10127, 'toxtricity-low-key', 849),
  e(849, 'toxtricity-amped', 849),
  e(741, 'oricorio-baile', 741),
  e(10125, 'oricorio-pom-pom', 741),
]

describe('resolvePokemonDbMon', () => {
  const r = (dex: number, label?: string) => resolvePokemonDbMon({ slug: 'x', dex, label, level: 50 }, pool).id

  it('should pick the default form when there is no label', () => {
    expect(r(38)).toBe(38)
    expect(r(555)).toBe(555)
  })

  it('should ignore cosmetic labels', () => {
    expect(r(678, 'Male')).toBe(678)
  })

  it('should pick an included alternate form when every label word appears in its slug', () => {
    expect(r(745, 'Midnight Form')).toBe(10126)
    expect(r(849, 'Low Key Form')).toBe(10127)
  })

  it('should keep the default when the label names the default form', () => {
    expect(r(745, 'Midday Form')).toBe(745)
    expect(r(849, 'Amped Form')).toBe(849)
  })

  it('should pick regional forms from the label', () => {
    expect(r(38, 'Alolan Ninetales')).toBe(10110)
    expect(r(555, 'Galarian Standard Mode')).toBe(10174)
  })

  it('should use label words to choose between regional forms of one species', () => {
    expect(r(128, 'Paldean Blaze Breed')).toBe(10251)
  })

  it('should pick megas from the label, honoring X/Y', () => {
    expect(r(282, 'Mega Gardevoir')).toBe(10051)
    expect(r(6, 'Mega Charizard Y')).toBe(10035)
  })

  it('should throw for an unknown dex number', () => {
    expect(() => r(9999)).toThrow(/9999/)
  })

  it('should throw when the label names a form that does not exist', () => {
    expect(() => r(282, 'Hisuian Gardevoir')).toThrow(/Hisuian/)
  })
})

describe('resolveDittoBaseMon', () => {
  const r = (slug: string, dex?: number) => resolveDittoBaseMon({ slug, dex, level: 50 }, pool).id

  it('should match an exact PokeAPI slug', () => {
    expect(r('ninetales-alola', 38)).toBe(10110)
    expect(r('charizard-mega-x', 6)).toBe(10034)
  })

  it('should match slugs that differ only by hyphens', () => {
    expect(r('oricorio-pompom', 741)).toBe(10125)
  })

  it('should map a bare species slug to the default form', () => {
    expect(r('darmanitan', 555)).toBe(555)
    expect(r('oricorio', 741)).toBe(741)
  })

  it('should throw instead of guessing when a form slug is unknown', () => {
    expect(() => r('darmanitan-zen', 555)).toThrow(/darmanitan-zen/)
  })

  it('should fall back to a default form whose slug starts with the given slug when dex is missing', () => {
    expect(r('meowstic')).toBe(678)
  })

  it('should throw when nothing matches', () => {
    expect(() => r('missingno')).toThrow(/missingno/)
  })
})

describe('sameTeam', () => {
  it('should ignore order', () => {
    expect(sameTeam([1, 2, 3], [3, 1, 2])).toBe(true)
  })

  it('should respect duplicates', () => {
    expect(sameTeam([1, 1, 2], [1, 2, 2])).toBe(false)
  })

  it('should be false for different lengths', () => {
    expect(sameTeam([1], [1, 2])).toBe(false)
  })
})
