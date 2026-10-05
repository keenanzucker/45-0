export const POKEMON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const

export type PokemonType = (typeof POKEMON_TYPES)[number]

export type Gen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const CATEGORIES = ['normal', 'legend', 'mega'] as const

export type Category = (typeof CATEGORIES)[number]

/** What kind of legend-class Pokémon this is; shown as the card tag. Only set when `category` is 'legend'. */
export type LegendKind = 'box-art' | 'legendary' | 'mythical' | 'paradox' | 'ultra-beast'

export interface Stats {
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

export interface PokemonEntry {
  /** PokeAPI pokemon id; alternate forms are 10000+ */
  id: number
  /** PokeAPI pokemon name, e.g. "charizard-mega-x" */
  slug: string
  /** Display name, e.g. "Mega Charizard X" */
  name: string
  speciesId: number
  gen: Gen
  types: PokemonType[]
  stats: Stats
  bst: number
  category: Category
  legendKind?: LegendKind
  /** Types this Pokémon takes no damage from because of an ability every version of it has (Levitate, ...). */
  immunities?: PokemonType[]
  isStarter: boolean
  /** No further evolution. The game pool is `isFinal` entries; the rest are kept for future modes. */
  isFinal: boolean
  /** Path under the site root, e.g. "/sprites/6.png" */
  sprite: string
}

export type FightTier = 'e4' | 'champion' | 'gym'

export interface GauntletFight {
  /** Stable id, e.g. "g1-lorelei" */
  id: string
  gen: Gen
  region: string
  name: string
  tier: FightTier
  /** Source game the team was taken from, e.g. "red-blue" */
  game: string
  /** Which of several teams was used (e.g. starter-dependent champion teams) */
  variant?: string
  /** Pokémon ids from pokemon.json, in party order */
  team: number[]
}
