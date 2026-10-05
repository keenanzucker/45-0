import type { PokemonType, Stats } from '../data/types.ts'

export const STAT_LABELS: Record<keyof Stats, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spa: 'SPA',
  spd: 'SPD',
  spe: 'SPE',
}

export const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof Stats)[]

/** Three-letter type tags for tight spaces such as table column headers. */
export const TYPE_ABBR: Record<PokemonType, string> = {
  normal: 'NRM',
  fire: 'FIR',
  water: 'WAT',
  electric: 'ELE',
  grass: 'GRS',
  ice: 'ICE',
  fighting: 'FGT',
  poison: 'PSN',
  ground: 'GRD',
  flying: 'FLY',
  psychic: 'PSY',
  bug: 'BUG',
  rock: 'RCK',
  ghost: 'GHO',
  dragon: 'DRG',
  dark: 'DRK',
  steel: 'STL',
  fairy: 'FAI',
}
