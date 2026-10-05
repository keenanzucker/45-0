import { describe, expect, it } from 'vitest'
import type { Category, PokemonEntry } from '../data/types.ts'
import type { SpinEntry } from '../engine/pool.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { unavailableReason } from './listing.ts'
import { sortAndFilter } from './listing.ts'

const mk = (id: number, name: string, over: Partial<PokemonEntry> = {}, selectable = true): SpinEntry => ({
  entry: mkEntry(id, 1, ['fire'], { name, ...over }),
  selectable,
})
const ids = (rs: SpinEntry[]) => rs.map((r) => r.entry.id)

const list = [
  mk(1, 'Zubat', { bst: 300, stats: { hp: 40, atk: 45, def: 35, spa: 30, spd: 40, spe: 55 } }),
  mk(2, 'Arbok', { bst: 438, stats: { hp: 60, atk: 95, def: 69, spa: 65, spd: 79, spe: 80 } }),
  mk(3, 'Mewtwo', { bst: 680, category: 'legend', stats: { hp: 106, atk: 110, def: 90, spa: 154, spd: 90, spe: 130 } }),
  mk(4, 'Gengar', { bst: 500, category: 'mega' as Category, stats: { hp: 60, atk: 65, def: 60, spa: 130, spd: 75, spe: 110 } }, false),
]

describe('sortAndFilter (normal mode)', () => {
  it('should sort by BST descending by default, with unselectable entries last', () => {
    expect(ids(sortAndFilter(list, { mode: 'normal', sort: 'bst', filter: 'all' }))).toEqual([3, 2, 1, 4])
  })

  it('should sort by any base stat, descending', () => {
    expect(ids(sortAndFilter(list, { mode: 'normal', sort: 'spe', filter: 'all' }))).toEqual([3, 2, 1, 4])
    expect(ids(sortAndFilter(list, { mode: 'normal', sort: 'atk', filter: 'all' }))).toEqual([3, 2, 1, 4])
    expect(ids(sortAndFilter(list, { mode: 'normal', sort: 'spa', filter: 'all' }))).toEqual([3, 2, 1, 4])
  })

  it('should sort by name ascending', () => {
    expect(ids(sortAndFilter(list, { mode: 'normal', sort: 'name', filter: 'all' }))).toEqual([2, 3, 1, 4])
  })

  it('should break ties by name', () => {
    const tied = [mk(1, 'Bbb', { bst: 400 }), mk(2, 'Aaa', { bst: 400 })]
    expect(ids(sortAndFilter(tied, { mode: 'normal', sort: 'bst', filter: 'all' }))).toEqual([2, 1])
  })

  it('should filter by category', () => {
    expect(ids(sortAndFilter(list, { mode: 'normal', sort: 'bst', filter: 'legend' }))).toEqual([3])
    expect(ids(sortAndFilter(list, { mode: 'normal', sort: 'bst', filter: 'normal' }))).toEqual([2, 1])
  })

  it('should not mutate the input', () => {
    const copy = [...list]
    sortAndFilter(list, { mode: 'normal', sort: 'name', filter: 'all' })
    expect(list).toEqual(copy)
  })
})

describe('sortAndFilter (hard mode)', () => {
  it('should always sort alphabetically, ignoring the sort key', () => {
    expect(ids(sortAndFilter(list, { mode: 'hard', sort: 'bst', filter: 'all' }))).toEqual([2, 3, 1, 4])
  })

  it('should still apply the category filter', () => {
    expect(ids(sortAndFilter(list, { mode: 'hard', sort: 'bst', filter: 'legend' }))).toEqual([3])
  })
})

describe('unavailableReason', () => {
  const owned = mkEntry(10, 1, ['fire'], { speciesId: 10 })
  const byId = new Map([[10, owned]])

  it('should say the species is already drafted when it, or another form of it, is on the roster', () => {
    const sameSpecies = mkEntry(11, 1, ['fire'], { speciesId: 10, category: 'mega' })
    expect(unavailableReason(sameSpecies, [10, null, null, null, null, null], byId)).toBe('Already on your team')
  })

  it('should say the special slot is taken otherwise', () => {
    const legend = mkEntry(12, 1, ['fire'], { category: 'legend' })
    expect(unavailableReason(legend, [null, null, null, 10, 11, null], byId)).toBe('Legend slots full')
    expect(unavailableReason(mkEntry(13, 1, ['fire'], { category: 'mega' }), [null, null, null, null, null, 10], byId)).toBe('Mega slot taken')
    expect(unavailableReason(mkEntry(14, 1, ['fire'], { category: 'mega' }), [null, null, null, null, null, 10], byId)).toBe('Mega slot taken')
  })
})
