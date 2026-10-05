import { describe, expect, it } from 'vitest'
import type { Category, PokemonEntry } from '../data/types.ts'
import { SLOTS, canFill, emptyRoster, isFull, openSlots, placementSlots, placeInRoster } from './slots.ts'

const mk = (id: number, category: Category = 'normal', speciesId = id): PokemonEntry => ({
  id,
  slug: `p${id}`,
  name: `P${id}`,
  speciesId,
  gen: 1,
  types: ['normal'],
  stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
  bst: 6,
  category,
  isStarter: false,
  isFinal: true,
  sprite: `/sprites/${id}.png`,
})

const byId = (entries: PokemonEntry[]) => new Map(entries.map((e) => [e.id, e]))

describe('slots layout', () => {
  it('should have 3 normal slots, 2 legend slots and a mega slot', () => {
    expect(SLOTS).toEqual(['normal', 'normal', 'normal', 'legend', 'legend', 'mega'])
  })
})

describe('canFill', () => {
  it('should let normal Pokémon fill any slot', () => {
    for (const slot of SLOTS) expect(canFill(slot, 'normal')).toBe(true)
  })

  it.each(['legend', 'mega'] as const)('should only let %s Pokémon fill their own slots', (cat) => {
    for (const slot of SLOTS) expect(canFill(slot, cat)).toBe(slot === cat)
  })
})

describe('roster helpers', () => {
  it('should start with six empty slots', () => {
    expect(emptyRoster()).toEqual([null, null, null, null, null, null])
  })

  it('should list open slot indexes and report when full', () => {
    const roster = [1, null, 2, null, null, null]
    expect(openSlots(roster)).toEqual([1, 3, 4, 5])
    expect(isFull(roster)).toBe(false)
    expect(isFull([1, 2, 3, 4, 5, 6])).toBe(true)
  })
})

describe('placementSlots', () => {
  const pool = [mk(1), mk(2), mk(3, 'legend'), mk(4, 'mega'), mk(5, 'legend'), mk(6, 'normal', 1)]
  const lookup = byId(pool)

  it('should offer every open slot to a normal Pokémon', () => {
    expect(placementSlots(emptyRoster(), pool[0], lookup)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('should offer only the matching special slots', () => {
    expect(placementSlots(emptyRoster(), pool[2], lookup)).toEqual([3, 4])
    expect(placementSlots(emptyRoster(), pool[4], lookup)).toEqual([3, 4])
    expect(placementSlots(emptyRoster(), pool[3], lookup)).toEqual([5])
  })

  it('should leave the other legend slot open once one is taken', () => {
    expect(placementSlots([null, null, null, 3, null, null], mk(9, 'legend'), lookup)).toEqual([4])
    expect(placementSlots([null, null, null, null, 3, null], mk(9, 'legend'), lookup)).toEqual([3])
  })

  it('should offer nothing once both legend slots are taken', () => {
    expect(placementSlots([null, null, null, 3, 5, null], mk(9, 'legend'), lookup)).toEqual([])
  })

  it('should offer nothing once the mega slot is taken', () => {
    expect(placementSlots([null, null, null, null, null, 4], mk(9, 'mega'), lookup)).toEqual([])
  })

  it('should skip filled slots', () => {
    expect(placementSlots([2, null, null, null, null, null], pool[0], lookup)).toEqual([1, 2, 3, 4, 5])
  })

  it('should offer nothing for a species already on the roster, including other forms', () => {
    const roster = [1, null, null, null, null, null]
    expect(placementSlots(roster, pool[0], lookup)).toEqual([])
    expect(placementSlots(roster, pool[5], lookup)).toEqual([])
  })
})

describe('placeInRoster', () => {
  const pool = [mk(1), mk(3, 'legend')]
  const lookup = byId(pool)

  it('should return a new roster with the Pokémon placed', () => {
    const roster = emptyRoster()
    const next = placeInRoster(roster, 2, pool[0], lookup)
    expect(next).toEqual([null, null, 1, null, null, null])
    expect(roster).toEqual(emptyRoster())
  })

  it('should throw for an invalid placement', () => {
    expect(() => placeInRoster(emptyRoster(), 0, pool[1], lookup)).toThrow(/slot/)
    expect(() => placeInRoster([1, null, null, null, null, null], 0, pool[0], lookup)).toThrow(/slot/)
  })
})
