import { describe, expect, it } from 'vitest'
import { buildPool, selectableCount } from './pool.ts'
import { seedRng } from './rng.ts'
import { MIN_CHOICES, drawReroll, drawSpin, rerollOptions } from './spin.ts'
import { emptyRoster } from './slots.ts'
import { gridEntries, mkEntry } from './testUtils.ts'

const bigPool = buildPool(gridEntries([1, 2, 3], ['fire', 'water', 'grass'], 6))

describe('drawSpin', () => {
  it('should draw a combo with enough selectable entries', () => {
    const [spin] = drawSpin(bigPool, emptyRoster(), seedRng(1))
    expect(selectableCount(bigPool, spin, emptyRoster())).toBeGreaterThanOrEqual(5)
  })

  it('should be deterministic for the same rng state and advance it', () => {
    const a = drawSpin(bigPool, emptyRoster(), seedRng(7))
    const b = drawSpin(bigPool, emptyRoster(), seedRng(7))
    expect(a).toEqual(b)
    expect(a[1]).not.toBe(seedRng(7))
  })

  it('should reach every valid combo over many draws', () => {
    const seen = new Set<string>()
    let rng = seedRng(3)
    for (let i = 0; i < 600; i++) {
      const [spin, next] = drawSpin(bigPool, emptyRoster(), rng)
      seen.add(`${spin.era}:${spin.type}`)
      rng = next
    }
    expect(seen.size).toBe(9)
  })

  it('should fall back to thinner combos when none meet the minimum', () => {
    const thin = buildPool(gridEntries([1, 2], ['fire'], 3))
    const [spin] = drawSpin(thin, emptyRoster(), seedRng(1), 5)
    expect(selectableCount(thin, spin, emptyRoster())).toBe(3)
  })

  it('should throw when nothing is selectable anywhere', () => {
    expect(() => drawSpin(buildPool([]), emptyRoster(), seedRng(1))).toThrow(/no valid spin/)
  })
})

describe('default minimum', () => {
  it('should be 2, so thin combos are allowed but single-choice ones are not', () => {
    expect(MIN_CHOICES).toBe(2)
    const pool = buildPool([
      ...gridEntries([1], ['fire'], 1),
      ...gridEntries([2], ['fire'], 2, 100),
      mkEntry(300, 3, ['fire']),
      mkEntry(301, 3, ['fire'], { category: 'mega', speciesId: 300 }),
    ])
    const seen = new Set<string>()
    let rng = seedRng(1)
    for (let i = 0; i < 200; i++) {
      const [spin, next] = drawSpin(pool, emptyRoster(), rng)
      seen.add(`${spin.era}:${spin.type}`)
      rng = next
    }
    expect([...seen]).toEqual(['2:fire'])
  })
})

describe('rerollOptions', () => {
  const current = { era: 1 as const, type: 'fire' as const }

  it('should offer other eras with the same type', () => {
    expect(rerollOptions(bigPool, emptyRoster(), current, 'era')).toEqual([
      { era: 2, type: 'fire' },
      { era: 3, type: 'fire' },
    ])
  })

  it('should offer other types with the same era', () => {
    expect(rerollOptions(bigPool, emptyRoster(), current, 'type')).toEqual([
      { era: 1, type: 'water' },
      { era: 1, type: 'grass' },
    ])
  })

  it('should skip combos that are too thin', () => {
    const pool = buildPool([...gridEntries([1, 2], ['fire'], 6), ...gridEntries([3], ['fire'], 2, 500)])
    expect(rerollOptions(pool, emptyRoster(), current, 'era', 5)).toEqual([{ era: 2, type: 'fire' }])
  })

  it('should offer nothing when no option meets the minimum, rather than a thin combo', () => {
    const pool = buildPool([...gridEntries([1], ['fire'], 6), ...gridEntries([2], ['fire'], 2, 500)])
    expect(rerollOptions(pool, emptyRoster(), current, 'era', 5)).toEqual([])
  })
})

describe('drawReroll', () => {
  const current = { era: 2 as const, type: 'water' as const }

  it('should change only the rerolled dimension', () => {
    const era = drawReroll(bigPool, emptyRoster(), current, 'era', seedRng(4))!
    expect(era[0].type).toBe('water')
    expect(era[0].era).not.toBe(2)
    const type = drawReroll(bigPool, emptyRoster(), current, 'type', seedRng(4))!
    expect(type[0].era).toBe(2)
    expect(type[0].type).not.toBe('water')
  })

  it('should return null when there is nothing to reroll to', () => {
    const single = buildPool(gridEntries([1], ['fire'], 6))
    expect(drawReroll(single, emptyRoster(), { era: 1, type: 'fire' }, 'era', seedRng(1))).toBeNull()
  })
})
