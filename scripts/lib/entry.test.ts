import { describe, expect, it } from 'vitest'
import {
  buildEntry,
  extractTypes,
  normalizeStats,
  pickSpriteUrl,
  type ApiPokemon,
  type ApiSpecies,
  type BuildOverrides,
} from './entry.ts'
import { classifyForm } from './forms.ts'

const apiStats = (v: [number, number, number, number, number, number]) =>
  ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((name, i) => ({
    base_stat: v[i],
    stat: { name },
  }))

const apiTypes = (...names: string[]) =>
  names.map((name, i) => ({ slot: i + 1, type: { name } }))

const sprites = { front_default: 'https://example.test/6.png', other: {} }

const charizard: ApiPokemon = {
  id: 6,
  name: 'charizard',
  types: apiTypes('fire', 'flying'),
  stats: apiStats([78, 84, 78, 109, 85, 100]),
  abilities: [
    { ability: { name: 'blaze' }, is_hidden: false, slot: 1 },
    { ability: { name: 'solar-power' }, is_hidden: true, slot: 3 },
  ],
  sprites,
}
const charizardSpecies: ApiSpecies = {
  id: 6,
  name: 'charizard',
  names: [{ name: 'Charizard', language: { name: 'en' } }],
  generation: { name: 'generation-i' },
  is_legendary: false,
  is_mythical: false,
}

const overrides: BuildOverrides = {
  category: { restricted: new Set(), paradox: new Set(), ultraBeasts: new Set() },
  baseFinal: new Set(),
  starters: new Set(['charizard']),
}

const form = (slug: string, isDefault: boolean) => {
  const f = classifyForm(slug, isDefault, new Set(['rotom-heat']))
  if (!f) throw new Error(`fixture ${slug} not classified`)
  return f
}

describe('normalizeStats', () => {
  it('should map PokeAPI stat names to short keys', () => {
    expect(normalizeStats(apiStats([1, 2, 3, 4, 5, 6]))).toEqual({
      hp: 1,
      atk: 2,
      def: 3,
      spa: 4,
      spd: 5,
      spe: 6,
    })
  })

  it('should throw when a stat is missing', () => {
    expect(() => normalizeStats(apiStats([1, 2, 3, 4, 5, 6]).slice(0, 5))).toThrow(/speed/)
  })
})

describe('extractTypes', () => {
  it('should return types ordered by slot', () => {
    const shuffled = [
      { slot: 2, type: { name: 'flying' } },
      { slot: 1, type: { name: 'fire' } },
    ]
    expect(extractTypes(shuffled)).toEqual(['fire', 'flying'])
  })

  it('should throw on a type outside the 18 standard types', () => {
    expect(() => extractTypes(apiTypes('stellar'))).toThrow(/stellar/)
  })
})

describe('pickSpriteUrl', () => {
  it('should prefer front_default', () => {
    expect(pickSpriteUrl({ front_default: 'a', other: { home: { front_default: 'b' } } })).toBe('a')
  })

  it('should fall back to the HOME sprite, then official artwork', () => {
    expect(
      pickSpriteUrl({ front_default: null, other: { home: { front_default: 'b' } } }),
    ).toBe('b')
    expect(
      pickSpriteUrl({
        front_default: null,
        other: { home: { front_default: null }, 'official-artwork': { front_default: 'c' } },
      }),
    ).toBe('c')
  })

  it('should return null when no sprite exists', () => {
    expect(pickSpriteUrl({ front_default: null, other: {} })).toBeNull()
  })
})

describe('buildEntry', () => {
  const build = (
    pokemon: ApiPokemon,
    species: ApiSpecies,
    f: ReturnType<typeof form>,
    chainFinals: string[],
    o: BuildOverrides = overrides,
  ) => buildEntry({ pokemon, species, form: f, chainFinals: new Set(chainFinals), overrides: o })

  it('should build a full entry for a final default form', () => {
    expect(build(charizard, charizardSpecies, form('charizard', true), ['charizard'])).toEqual({
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
    })
  })

  it('should record the legend kind of a legend-class Pokémon', () => {
    const o: BuildOverrides = { ...overrides, category: { ...overrides.category, restricted: new Set(['charizard']) } }
    expect(build(charizard, charizardSpecies, form('charizard', true), ['charizard'], o)).toMatchObject({
      category: 'legend',
      legendKind: 'box-art',
    })
  })

  it('should not add a legend kind to a normal Pokémon', () => {
    const entry = build(charizard, charizardSpecies, form('charizard', true), ['charizard'])
    expect('legendKind' in entry).toBe(false)
  })

  it('should keep non-final evolutions but flag them isFinal false', () => {
    const charmeleon = { ...charizard, id: 5, name: 'charmeleon' }
    const species = { ...charizardSpecies, id: 5, name: 'charmeleon', names: [] }
    expect(build(charmeleon, species, form('charmeleon', true), ['charizard'])).toMatchObject({
      id: 5,
      name: 'Charmeleon',
      isFinal: false,
    })
  })

  it('should build megas with the base species generation and not flag them as starters', () => {
    const mega: ApiPokemon = {
      ...charizard,
      id: 10034,
      name: 'charizard-mega-x',
      types: apiTypes('fire', 'dragon'),
      stats: apiStats([78, 130, 111, 130, 85, 100]),
    }
    const entry = build(mega, charizardSpecies, form('charizard-mega-x', false), ['charizard'])
    expect(entry).toMatchObject({
      id: 10034,
      name: 'Mega Charizard X',
      speciesId: 6,
      gen: 1,
      types: ['fire', 'dragon'],
      category: 'mega',
      isStarter: false,
      isFinal: true,
      sprite: '/sprites/10034.png',
    })
  })

  it('should build final regional forms with the region generation', () => {
    const ninetales: ApiPokemon = {
      id: 10104,
      name: 'ninetales-alola',
      types: apiTypes('ice', 'fairy'),
      stats: apiStats([73, 67, 75, 81, 100, 109]),
      abilities: [{ ability: { name: 'snow-cloak' }, is_hidden: false, slot: 1 }],
      sprites,
    }
    const species: ApiSpecies = {
      ...charizardSpecies,
      id: 38,
      name: 'ninetales',
      names: [{ name: 'Ninetales', language: { name: 'en' } }],
    }
    const entry = build(ninetales, species, form('ninetales-alola', false), ['ninetales'])
    expect(entry).toMatchObject({ name: 'Alolan Ninetales', gen: 7, category: 'normal' })
  })

  it('should build alternate forms with their own types and the species generation', () => {
    const rotomHeat: ApiPokemon = {
      id: 10008,
      name: 'rotom-heat',
      types: apiTypes('electric', 'fire'),
      stats: apiStats([50, 65, 107, 105, 107, 86]),
      abilities: [{ ability: { name: 'levitate' }, is_hidden: false, slot: 1 }],
      sprites,
    }
    const species: ApiSpecies = {
      ...charizardSpecies,
      id: 479,
      name: 'rotom',
      names: [{ name: 'Rotom', language: { name: 'en' } }],
      generation: { name: 'generation-iv' },
    }
    expect(build(rotomHeat, species, form('rotom-heat', false), ['rotom'])).toMatchObject({
      name: 'Rotom (Heat)',
      gen: 4,
      types: ['electric', 'fire'],
      category: 'normal',
      isFinal: true,
    })
  })

  it('should record the immunity of a Pokémon whose every ability grants it', () => {
    const rotomHeat: ApiPokemon = {
      ...charizard,
      id: 10008,
      name: 'rotom-heat',
      types: apiTypes('electric', 'fire'),
      abilities: [{ ability: { name: 'levitate' }, is_hidden: false, slot: 1 }],
    }
    const species: ApiSpecies = { ...charizardSpecies, id: 479, name: 'rotom', names: [], generation: { name: 'generation-iv' } }
    expect(build(rotomHeat, species, form('rotom-heat', false), ['rotom']).immunities).toEqual(['ground'])
  })

  it('should leave the field out when the immunity is not guaranteed', () => {
    const entry = build(charizard, charizardSpecies, form('charizard', true), ['charizard'])
    expect('immunities' in entry).toBe(false)
  })

  it('should flag non-final regional forms isFinal false', () => {
    const vulpix: ApiPokemon = { ...charizard, id: 10103, name: 'vulpix-alola' }
    const species: ApiSpecies = { ...charizardSpecies, id: 37, name: 'vulpix', names: [] }
    expect(build(vulpix, species, form('vulpix-alola', false), ['ninetales'])).toMatchObject({
      name: 'Alolan Vulpix',
      gen: 7,
      isFinal: false,
    })
  })

  it('should fall back to a title-cased slug when there is no English name', () => {
    const species: ApiSpecies = { ...charizardSpecies, names: [] }
    expect(build(charizard, species, form('charizard', true), ['charizard'])?.name).toBe('Charizard')
    const odd = { ...charizard, name: 'mr-rime' }
    const oddSpecies: ApiSpecies = { ...charizardSpecies, name: 'mr-rime', names: [] }
    expect(build(odd, oddSpecies, form('mr-rime', true), ['mr-rime'])?.name).toBe('Mr Rime')
  })

  it('should throw on an unknown generation', () => {
    const species: ApiSpecies = { ...charizardSpecies, generation: { name: 'generation-x' } }
    expect(() => build(charizard, species, form('charizard', true), ['charizard'])).toThrow(
      /generation-x/,
    )
  })

  it('should throw when no sprite is available', () => {
    const bare = { ...charizard, sprites: { front_default: null, other: {} } }
    expect(() => build(bare, charizardSpecies, form('charizard', true), ['charizard'])).toThrow(
      /sprite/,
    )
  })
})
