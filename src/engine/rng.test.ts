import { describe, expect, it } from 'vitest'
import { nextFloat, nextInt, pickOne, seedRng } from './rng.ts'

describe('rng', () => {
  it('should produce the same sequence for the same seed', () => {
    const run = (seed: number) => {
      let s = seedRng(seed)
      const out: number[] = []
      for (let i = 0; i < 5; i++) {
        const [v, next] = nextFloat(s)
        out.push(v)
        s = next
      }
      return out
    }
    expect(run(42)).toEqual(run(42))
    expect(run(42)).not.toEqual(run(43))
  })

  it('should return floats in [0, 1)', () => {
    let s = seedRng(7)
    for (let i = 0; i < 1000; i++) {
      const [v, next] = nextFloat(s)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      s = next
    }
  })

  it('should keep its state a plain integer so it can be saved as JSON', () => {
    const [, next] = nextFloat(seedRng(123))
    expect(Number.isInteger(next)).toBe(true)
    expect(JSON.parse(JSON.stringify(next))).toBe(next)
  })

  it('should return ints in [0, max) with a roughly uniform spread', () => {
    let s = seedRng(99)
    const counts = [0, 0, 0, 0]
    for (let i = 0; i < 8000; i++) {
      const [v, next] = nextInt(s, 4)
      counts[v]++
      s = next
    }
    for (const c of counts) expect(c).toBeGreaterThan(1700)
    for (const c of counts) expect(c).toBeLessThan(2300)
  })

  it('should pick an element of the list and advance the state', () => {
    const [item, next] = pickOne(seedRng(5), ['a', 'b', 'c'])
    expect(['a', 'b', 'c']).toContain(item)
    expect(next).not.toBe(seedRng(5))
  })

  it('should throw when picking from an empty list', () => {
    expect(() => pickOne(seedRng(1), [])).toThrow(/empty/)
  })
})
