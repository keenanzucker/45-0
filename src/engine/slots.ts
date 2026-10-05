import type { Category, PokemonEntry } from '../data/types.ts'

export type SlotKind = Category

/** Three normal slots, two legend slots (any legend-class Pokémon) and one mega slot. */
export const SLOTS: readonly SlotKind[] = ['normal', 'normal', 'normal', 'legend', 'legend', 'mega']

/** A roster holds one pokemon id (or null) per slot, in SLOTS order. */
export type Roster = (number | null)[]

export const emptyRoster = (): Roster => SLOTS.map(() => null)

export const openSlots = (roster: Roster): number[] =>
  roster.flatMap((id, i) => (id === null ? [i] : []))

export const isFull = (roster: Roster): boolean => roster.every((id) => id !== null)

/** Specials only fit their own slot; normal Pokémon fit anywhere. */
export const canFill = (slot: SlotKind, category: Category): boolean =>
  category === 'normal' || slot === category

type Lookup = ReadonlyMap<number, PokemonEntry>

/** Open slot indexes where `entry` may be placed. Empty if its species is already on the roster. */
export function placementSlots(roster: Roster, entry: PokemonEntry, byId: Lookup): number[] {
  const speciesTaken = roster.some(
    (id) => id !== null && byId.get(id)?.speciesId === entry.speciesId,
  )
  if (speciesTaken) return []
  return openSlots(roster).filter((i) => canFill(SLOTS[i], entry.category))
}

export function placeInRoster(
  roster: Roster,
  slotIndex: number,
  entry: PokemonEntry,
  byId: Lookup,
): Roster {
  if (!placementSlots(roster, entry, byId).includes(slotIndex)) {
    throw new Error(`${entry.name} cannot be placed in slot ${slotIndex}`)
  }
  return roster.map((id, i) => (i === slotIndex ? entry.id : id))
}
