import { describe, expect, it } from 'vitest'
import { mkEntry } from '../engine/testUtils.ts'
import { makeBurst } from './burst.ts'

const entries = Array.from({ length: 30 }, (_, i) => mkEntry(i + 1, 1, ['fire']))

describe('makeBurst', () => {
  it('should pick distinct Pokémon when there are enough', () => {
    const burst = makeBurst(entries, 10, 7)
    expect(burst).toHaveLength(10)
    expect(new Set(burst.map((b) => b.entry.id)).size).toBe(10)
  })

  it('should return the same burst for the same seed', () => {
    expect(makeBurst(entries, 10, 7)).toEqual(makeBurst(entries, 10, 7))
  })

  it('should send sprites out in different directions', () => {
    const burst = makeBurst(entries, 10, 7)
    const directions = new Set(burst.map((b) => `${Math.round(b.dx)},${Math.round(b.dy)}`))
    expect(directions.size).toBe(10)
    expect(burst.some((b) => b.dx > 0)).toBe(true)
    expect(burst.some((b) => b.dx < 0)).toBe(true)
    expect(burst.some((b) => b.dy > 0)).toBe(true)
    expect(burst.some((b) => b.dy < 0)).toBe(true)
  })

  it('should use every Pokémon when there are fewer than asked for', () => {
    expect(makeBurst(entries.slice(0, 4), 10, 7)).toHaveLength(4)
  })

  it('should be empty without Pokémon', () => {
    expect(makeBurst([], 10, 7)).toEqual([])
  })
})
