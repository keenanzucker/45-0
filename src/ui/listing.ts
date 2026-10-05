import type { Category, PokemonEntry, Stats } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import type { SpinEntry } from '../engine/pool.ts'

export type SortKey = 'bst' | keyof Stats | 'name'
export type CategoryFilter = 'all' | Category

const byName = (a: SpinEntry, b: SpinEntry) => a.entry.name.localeCompare(b.entry.name)

/**
 * Orders the pick list. Selectable entries come first so dimmed ones don't push real
 * choices off a small screen. Normal mode sorts by the chosen key (stats descending, name
 * ascending); hard mode is always alphabetical so nothing hints at strength.
 */
export function sortAndFilter(
  results: readonly SpinEntry[],
  opts: { mode: Mode; sort: SortKey; filter: CategoryFilter },
): SpinEntry[] {
  const { mode, sort, filter } = opts
  const shown = results.filter((r) => filter === 'all' || r.entry.category === filter)
  const value = (r: SpinEntry) => (sort === 'bst' ? r.entry.bst : r.entry.stats[sort as keyof Stats])
  return [...shown].sort((a, b) => {
    if (a.selectable !== b.selectable) return a.selectable ? -1 : 1
    if (mode === 'normal' && sort !== 'name') {
      const diff = value(b) - value(a)
      if (diff !== 0) return diff
    }
    return byName(a, b)
  })
}

const SLOTS_FULL: Record<Category, string> = {
  normal: 'No slot open',
  legend: 'Legend slots full',
  mega: 'Mega slot taken',
}

/** Why a spun entry can't be picked, for the dimmed rows in the pick list. */
export function unavailableReason(
  entry: PokemonEntry,
  roster: readonly (number | null)[],
  byId: ReadonlyMap<number, PokemonEntry>,
): string {
  const speciesTaken = roster.some((id) => id !== null && byId.get(id)?.speciesId === entry.speciesId)
  return speciesTaken ? 'Already on your team' : SLOTS_FULL[entry.category]
}
