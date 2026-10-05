import {
  POKEMON_TYPES,
  type Gen,
  type PokemonEntry,
  type PokemonType,
  type Stats,
} from '../../src/data/types.ts'
import { guaranteedImmunities, type ApiAbility } from './abilities.ts'
import { classifyCategory, type CategoryOverrides } from './classify.ts'
import { isFinalForm } from './evolution.ts'
import { formDisplayName, formGen, type FormInfo } from './forms.ts'

export interface ApiPokemon {
  id: number
  name: string
  types: { slot: number; type: { name: string } }[]
  stats: { base_stat: number; stat: { name: string } }[]
  abilities: ApiAbility[]
  sprites: ApiSprites
}

export interface ApiSprites {
  front_default: string | null
  other?: {
    home?: { front_default: string | null }
    'official-artwork'?: { front_default: string | null }
  }
}

export interface ApiSpecies {
  id: number
  name: string
  names: { name: string; language: { name: string } }[]
  generation: { name: string }
  is_legendary: boolean
  is_mythical: boolean
}

export interface BuildOverrides {
  category: CategoryOverrides
  baseFinal: ReadonlySet<string>
  starters: ReadonlySet<string>
}

const STAT_KEYS: [keyof Stats, string][] = [
  ['hp', 'hp'],
  ['atk', 'attack'],
  ['def', 'defense'],
  ['spa', 'special-attack'],
  ['spd', 'special-defense'],
  ['spe', 'speed'],
]

const GENERATIONS: Record<string, Gen> = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
}

export function normalizeStats(apiStats: ApiPokemon['stats']): Stats {
  const out = {} as Stats
  for (const [key, apiName] of STAT_KEYS) {
    const found = apiStats.find((s) => s.stat.name === apiName)
    if (!found) throw new Error(`missing stat ${apiName}`)
    out[key] = found.base_stat
  }
  return out
}

export function extractTypes(apiTypes: ApiPokemon['types']): PokemonType[] {
  return [...apiTypes]
    .sort((a, b) => a.slot - b.slot)
    .map(({ type }) => {
      if (!(POKEMON_TYPES as readonly string[]).includes(type.name)) {
        throw new Error(`unknown type ${type.name}`)
      }
      return type.name as PokemonType
    })
}

export function pickSpriteUrl(sprites: ApiSprites): string | null {
  return (
    sprites.front_default ??
    sprites.other?.home?.front_default ??
    sprites.other?.['official-artwork']?.front_default ??
    null
  )
}

const speciesDisplayName = (species: ApiSpecies) =>
  species.names.find((n) => n.language.name === 'en')?.name ??
  species.name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')

export function buildEntry(input: {
  pokemon: ApiPokemon
  species: ApiSpecies
  form: FormInfo
  chainFinals: ReadonlySet<string>
  overrides: BuildOverrides
}): PokemonEntry {
  const { pokemon, species, form, chainFinals, overrides } = input

  const speciesGen = GENERATIONS[species.generation.name]
  if (!speciesGen) throw new Error(`unknown generation ${species.generation.name}`)
  if (!pickSpriteUrl(pokemon.sprites)) throw new Error(`no sprite for ${pokemon.name}`)

  const stats = normalizeStats(pokemon.stats)
  const immunities = guaranteedImmunities(pokemon.abilities)
  return {
    id: pokemon.id,
    slug: pokemon.name,
    name: formDisplayName(speciesDisplayName(species), species.name, pokemon.name, form),
    speciesId: species.id,
    gen: formGen(speciesGen, form),
    types: extractTypes(pokemon.types),
    stats,
    bst: Object.values(stats).reduce((sum, v) => sum + v, 0),
    ...classifyCategory(
      {
        speciesSlug: species.name,
        isLegendary: species.is_legendary,
        isMythical: species.is_mythical,
        form,
      },
      overrides.category,
    ),
    isStarter: form.kind !== 'mega' && overrides.starters.has(species.name),
    isFinal: isFinalForm({
      speciesSlug: species.name,
      form,
      chainFinals,
      baseFinalOverrides: overrides.baseFinal,
    }),
    ...(immunities.length > 0 ? { immunities } : {}),
    sprite: `/sprites/${pokemon.id}.png`,
  }
}
