import { POKEMON_TYPES, type Gen, type PokemonEntry, type PokemonType } from '../data/types.ts'
import { placementSlots, type Roster } from './slots.ts'

export interface Spin {
  era: Gen
  type: PokemonType
}

export interface Pool {
  /** Every entry, including non-final ones (kept for future modes). */
  all: PokemonEntry[]
  /** The game pool: final evolutions only. */
  playable: PokemonEntry[]
  byId: Map<number, PokemonEntry>
  /** Playable entries per "<era>:<type>"; dual types appear under both types. */
  combos: Map<string, PokemonEntry[]>
}

export const ERAS: readonly Gen[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
export const TYPES = POKEMON_TYPES

export const comboKey = (era: Gen, type: PokemonType): string => `${era}:${type}`

export function buildPool(entries: PokemonEntry[]): Pool {
  const playable = entries.filter((e) => e.isFinal)
  const combos = new Map<string, PokemonEntry[]>()
  for (const e of playable) {
    for (const type of e.types) {
      const key = comboKey(e.gen, type)
      const list = combos.get(key)
      if (list) list.push(e)
      else combos.set(key, [e])
    }
  }
  return { all: entries, playable, byId: new Map(entries.map((e) => [e.id, e])), combos }
}

export interface SpinEntry {
  entry: PokemonEntry
  /** False when no open slot can take it (special slot full) or its species is already drafted. */
  selectable: boolean
}

export function spinResults(pool: Pool, spin: Spin, roster: Roster): SpinEntry[] {
  return (pool.combos.get(comboKey(spin.era, spin.type)) ?? []).map((entry) => ({
    entry,
    selectable: placementSlots(roster, entry, pool.byId).length > 0,
  }))
}

/** Distinct selectable species: a Pokémon and its Mega are one choice under the one-per-species rule. */
export const selectableCount = (pool: Pool, spin: Spin, roster: Roster): number =>
  new Set(
    spinResults(pool, spin, roster)
      .filter((r) => r.selectable)
      .map((r) => r.entry.speciesId),
  ).size

/** Every (era, type) combo with at least `minChoices` selectable species, in era-then-type order. */
export function validSpins(pool: Pool, roster: Roster, minChoices: number): Spin[] {
  const spins: Spin[] = []
  for (const era of ERAS) {
    for (const type of TYPES) {
      const spin = { era, type }
      if (selectableCount(pool, spin, roster) >= minChoices) spins.push(spin)
    }
  }
  return spins
}
