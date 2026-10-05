import type { PokemonType } from '../data/types.ts'

interface Row {
  double?: PokemonType[]
  half?: PokemonType[]
  none?: PokemonType[]
}

/** Modern (Gen 6+) 18-type chart, attacker -> defenders it is not neutral against. */
const CHART: Record<PokemonType, Row> = {
  normal: { half: ['rock', 'steel'], none: ['ghost'] },
  fire: { double: ['grass', 'ice', 'bug', 'steel'], half: ['fire', 'water', 'rock', 'dragon'] },
  water: { double: ['fire', 'ground', 'rock'], half: ['water', 'grass', 'dragon'] },
  electric: { double: ['water', 'flying'], half: ['electric', 'grass', 'dragon'], none: ['ground'] },
  grass: {
    double: ['water', 'ground', 'rock'],
    half: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'],
  },
  ice: { double: ['grass', 'ground', 'flying', 'dragon'], half: ['fire', 'water', 'ice', 'steel'] },
  fighting: {
    double: ['normal', 'ice', 'rock', 'dark', 'steel'],
    half: ['poison', 'flying', 'psychic', 'bug', 'fairy'],
    none: ['ghost'],
  },
  poison: { double: ['grass', 'fairy'], half: ['poison', 'ground', 'rock', 'ghost'], none: ['steel'] },
  ground: {
    double: ['fire', 'electric', 'poison', 'rock', 'steel'],
    half: ['grass', 'bug'],
    none: ['flying'],
  },
  flying: { double: ['grass', 'fighting', 'bug'], half: ['electric', 'rock', 'steel'] },
  psychic: { double: ['fighting', 'poison'], half: ['psychic', 'steel'], none: ['dark'] },
  bug: {
    double: ['grass', 'psychic', 'dark'],
    half: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'],
  },
  rock: { double: ['fire', 'ice', 'flying', 'bug'], half: ['fighting', 'ground', 'steel'] },
  ghost: { double: ['psychic', 'ghost'], half: ['dark'], none: ['normal'] },
  dragon: { double: ['dragon'], half: ['steel'], none: ['fairy'] },
  dark: { double: ['psychic', 'ghost'], half: ['fighting', 'dark', 'fairy'] },
  steel: { double: ['ice', 'rock', 'fairy'], half: ['fire', 'water', 'electric', 'steel'] },
  fairy: { double: ['fighting', 'dragon', 'dark'], half: ['fire', 'poison', 'steel'] },
}

const single = (attacker: PokemonType, defender: PokemonType): number => {
  const row = CHART[attacker]
  if (row.none?.includes(defender)) return 0
  if (row.double?.includes(defender)) return 2
  if (row.half?.includes(defender)) return 0.5
  return 1
}

/** Damage multiplier of an attacking type against a defender with one or two types. */
export function effectiveness(attacker: PokemonType, defender: readonly PokemonType[]): number {
  return defender.reduce((mult, type) => mult * single(attacker, type), 1)
}

/** Damage multiplier against a defender, counting immunities from its abilities as well as its types. */
export function damageMultiplier(
  attacker: PokemonType,
  defender: { types: readonly PokemonType[]; immunities?: readonly PokemonType[] },
): number {
  return defender.immunities?.includes(attacker) ? 0 : effectiveness(attacker, defender.types)
}
