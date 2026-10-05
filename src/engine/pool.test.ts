import { describe, expect, it } from 'vitest'
import { buildPool, comboKey, selectableCount, spinResults, validSpins } from './pool.ts'
import { emptyRoster } from './slots.ts'
import { gridEntries, mkEntry } from './testUtils.ts'

describe('buildPool', () => {
  const a = mkEntry(1, 1, ['fire'])
  const b = mkEntry(2, 1, ['water', 'flying'])
  const c = mkEntry(3, 1, ['fire'], { isFinal: false })
  const pool = buildPool([a, b, c])

  it('should only play final evolutions but keep every entry findable by id', () => {
    expect(pool.playable.map((e) => e.id)).toEqual([1, 2])
    expect(pool.byId.get(3)).toBe(c)
  })

  it('should index playable entries by (era, type), with dual types under both', () => {
    expect(pool.combos.get(comboKey(1, 'fire'))).toEqual([a])
    expect(pool.combos.get(comboKey(1, 'water'))).toEqual([b])
    expect(pool.combos.get(comboKey(1, 'flying'))).toEqual([b])
    expect(pool.combos.get(comboKey(2, 'fire'))).toBeUndefined()
  })
})

describe('spinResults', () => {
  const normals = gridEntries([1], ['fire'], 6) // ids 1..6
  const legend = mkEntry(7, 1, ['fire'], { category: 'legend' })
  const placedLegend = mkEntry(90, 1, ['water'], { category: 'legend' })
  const placedRare = mkEntry(91, 1, ['water'], { category: 'legend' })
  const pool = buildPool([...normals, legend, placedLegend, placedRare])
  const spin = { era: 1 as const, type: 'fire' as const }

  it('should list every entry of the combo, all selectable on an empty roster', () => {
    const results = spinResults(pool, spin, emptyRoster())
    expect(results.map((r) => r.entry.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(results.every((r) => r.selectable)).toBe(true)
  })

  it('should keep a legend selectable while one of the two legend slots is open', () => {
    const roster = [null, null, null, null, 90, null]
    expect(spinResults(pool, spin, roster).find((r) => r.entry.id === 7)?.selectable).toBe(true)
  })

  it('should mark a special unselectable once its slots are taken, but keep normals selectable', () => {
    const roster = [null, null, null, 91, 90, null]
    const results = spinResults(pool, spin, roster)
    expect(results.find((r) => r.entry.id === 7)?.selectable).toBe(false)
    expect(results.filter((r) => r.entry.category === 'normal').every((r) => r.selectable)).toBe(true)
  })

  it('should mark a species already on the roster unselectable', () => {
    const roster = [1, null, null, null, null, null]
    const results = spinResults(pool, spin, roster)
    expect(results.find((r) => r.entry.id === 1)?.selectable).toBe(false)
    expect(selectableCount(pool, spin, roster)).toBe(6)
  })

  it('should still allow normals to fill the last open special slot', () => {
    const roster = [1, 2, 3, 91, 90, null]
    expect(selectableCount(pool, spin, roster)).toBe(3)
  })

  it('should count each species once, so a Pokémon and its Mega are a single choice', () => {
    const gengar = mkEntry(10, 1, ['ghost'])
    const megaGengar = mkEntry(11, 1, ['ghost'], { category: 'mega', speciesId: 10 })
    const p = buildPool([gengar, megaGengar])
    const ghost = { era: 1 as const, type: 'ghost' as const }
    expect(spinResults(p, ghost, emptyRoster()).filter((r) => r.selectable)).toHaveLength(2)
    expect(selectableCount(p, ghost, emptyRoster())).toBe(1)
  })

  it('should return nothing for a combo with no entries', () => {
    expect(spinResults(pool, { era: 2, type: 'water' }, emptyRoster())).toEqual([])
  })
})

describe('validSpins', () => {
  const pool = buildPool([...gridEntries([1], ['fire'], 6), ...gridEntries([2], ['water'], 3, 100)])

  it('should only include combos with enough selectable entries', () => {
    expect(validSpins(pool, emptyRoster(), 5)).toEqual([{ era: 1, type: 'fire' }])
    expect(validSpins(pool, emptyRoster(), 3)).toEqual([
      { era: 1, type: 'fire' },
      { era: 2, type: 'water' },
    ])
  })

  it('should account for the roster when counting selectable entries', () => {
    const roster = [1, 2, null, null, null, null]
    expect(validSpins(pool, roster, 5)).toEqual([])
    expect(validSpins(pool, roster, 3)).toEqual([
      { era: 1, type: 'fire' },
      { era: 2, type: 'water' },
    ])
  })
})
