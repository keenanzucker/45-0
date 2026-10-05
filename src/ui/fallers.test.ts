import { describe, expect, it } from 'vitest'
import { mkEntry } from '../engine/testUtils.ts'
import { makeFallers, pickReplacement } from './fallers.ts'

const entries = Array.from({ length: 30 }, (_, i) => mkEntry(i + 1, 1, ['fire']))

describe('makeFallers', () => {
  it('should pick the requested number of distinct Pokémon', () => {
    const fallers = makeFallers(entries, 14, 7)
    expect(fallers).toHaveLength(14)
    expect(new Set(fallers.map((f) => f.entry.id)).size).toBe(14)
  })

  it('should never ask for more Pokémon than exist', () => {
    expect(makeFallers(entries.slice(0, 3), 14, 7)).toHaveLength(3)
    expect(makeFallers([], 14, 7)).toEqual([])
  })

  it('should replay the same scene for the same seed and change it for another', () => {
    expect(makeFallers(entries, 14, 7)).toEqual(makeFallers(entries, 14, 7))
    expect(makeFallers(entries, 14, 7)).not.toEqual(makeFallers(entries, 14, 8))
  })

  it('should keep every sprite on screen, a sensible size, and already mid-fall', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const f of makeFallers(entries, 14, seed)) {
        expect(f.left).toBeGreaterThanOrEqual(0)
        expect(f.left).toBeLessThanOrEqual(92)
        expect(f.size).toBeGreaterThanOrEqual(34)
        expect(f.size).toBeLessThanOrEqual(60)
        expect(f.duration).toBeGreaterThanOrEqual(8)
        expect(f.duration).toBeLessThanOrEqual(16)
        expect(f.delay).toBeLessThanOrEqual(0)
        expect(f.delay).toBeGreaterThanOrEqual(-f.duration)
        expect(f.sway).toBeGreaterThanOrEqual(2)
        expect(f.sway).toBeLessThanOrEqual(4)
      }
    }
  })

  it('should spread sprites across the width instead of clumping', () => {
    const lefts = makeFallers(entries, 14, 3).map((f) => f.left)
    expect(Math.max(...lefts) - Math.min(...lefts)).toBeGreaterThan(50)
  })
})

describe('pickReplacement', () => {
  it('should pick a Pokémon that is not already falling', () => {
    const shown = new Set(entries.slice(0, 29).map((e) => e.id))
    const [pick] = pickReplacement(entries, shown, 1)
    expect(pick?.id).toBe(30)
  })

  it('should give nothing back when every Pokémon is already falling', () => {
    const [pick] = pickReplacement(entries.slice(0, 3), new Set([1, 2, 3]), 1)
    expect(pick).toBeNull()
  })

  it('should be repeatable for the same state and advance the state', () => {
    const shown = new Set([1, 2, 3])
    const [a, next] = pickReplacement(entries, shown, 9)
    expect(pickReplacement(entries, shown, 9)[0]).toEqual(a)
    expect(next).not.toBe(9)
  })

  it('should eventually offer different Pokémon rather than the same one', () => {
    let rng = 5
    const seen = new Set<number>()
    for (let i = 0; i < 20; i++) {
      const [pick, next] = pickReplacement(entries, new Set(), rng)
      seen.add(pick!.id)
      rng = next
    }
    expect(seen.size).toBeGreaterThan(5)
  })
})
