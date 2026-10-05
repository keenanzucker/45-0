import { describe, expect, it } from 'vitest'
import { POKEMON_TYPES } from '../data/types.ts'
import { TYPE_ABBR } from './labels.ts'

describe('TYPE_ABBR', () => {
  it('should give every type a distinct three-letter uppercase abbreviation', () => {
    const abbrs = POKEMON_TYPES.map((t) => TYPE_ABBR[t])
    for (const a of abbrs) expect(a).toMatch(/^[A-Z]{3}$/)
    expect(new Set(abbrs).size).toBe(POKEMON_TYPES.length)
  })

  it('should start with the first letters of the type name', () => {
    expect(TYPE_ABBR.fire).toBe('FIR')
    expect(TYPE_ABBR.psychic).toBe('PSY')
  })
})
