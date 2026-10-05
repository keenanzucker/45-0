/**
 * Seedable PRNG (mulberry32) written as pure functions over an integer state,
 * so the state can live in the game state, be saved as JSON, and be replayed.
 */
export const seedRng = (seed: number): number => seed | 0

/** Returns a float in [0, 1) and the next state. */
export function nextFloat(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0
  let t = Math.imul(next ^ (next >>> 15), 1 | next)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** Returns an integer in [0, max) and the next state. */
export function nextInt(state: number, max: number): [number, number] {
  const [v, next] = nextFloat(state)
  return [Math.floor(v * max), next]
}

export function pickOne<T>(state: number, items: readonly T[]): [T, number] {
  if (items.length === 0) throw new Error('cannot pick from an empty list')
  const [i, next] = nextInt(state, items.length)
  return [items[i], next]
}
