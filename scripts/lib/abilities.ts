import type { PokemonType } from '../../src/data/types.ts'

/** Abilities that make a Pokémon take no damage from one attacking type. */
export const IMMUNITY_ABILITIES: Readonly<Record<string, PokemonType>> = {
  levitate: 'ground',
  'earth-eater': 'ground',
  'flash-fire': 'fire',
  'well-baked-body': 'fire',
  'water-absorb': 'water',
  'storm-drain': 'water',
  'dry-skin': 'water',
  'volt-absorb': 'electric',
  'lightning-rod': 'electric',
  'motor-drive': 'electric',
  'sap-sipper': 'grass',
}

export interface ApiAbility {
  ability: { name: string }
  is_hidden: boolean
  slot: number
}

/**
 * Immunities a Pokémon always has: every ability it can have (hidden ones included) grants
 * the same one. The game has no ability choice, so a Pokémon that only might have the
 * ability gets nothing; see SPEC §13.
 */
export function guaranteedImmunities(abilities: readonly ApiAbility[]): PokemonType[] {
  const types = abilities.map((a) => IMMUNITY_ABILITIES[a.ability.name])
  const [first] = types
  return first !== undefined && types.every((t) => t === first) ? [first] : []
}
