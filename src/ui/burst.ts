import type { PokemonEntry } from '../data/types.ts'
import { nextFloat, nextInt, seedRng } from '../engine/rng.ts'

export interface BurstSprite {
  entry: PokemonEntry
  /** Where the sprite ends up, in px from where the burst started. */
  dx: number
  dy: number
  /** Sprite size in px. */
  size: number
  /** Degrees turned on the way out. */
  spin: number
}

/** Distinct Pokémon fanned out evenly around a point; same seed, same burst. */
export function makeBurst(entries: readonly PokemonEntry[], count: number, seed: number): BurstSprite[] {
  const pool = [...entries]
  const total = Math.min(count, pool.length)
  let rng = seedRng(seed)
  const sprites: BurstSprite[] = []
  for (let i = 0; i < total; i++) {
    let pick: number, jitter: number, distance: number, size: number, spin: number
    ;[pick, rng] = nextInt(rng, pool.length)
    ;[jitter, rng] = nextFloat(rng)
    ;[distance, rng] = nextInt(rng, 70)
    ;[size, rng] = nextInt(rng, 14)
    ;[spin, rng] = nextInt(rng, 360)
    const [entry] = pool.splice(pick, 1)
    const angle = ((i + jitter * 0.6) / total) * 2 * Math.PI
    sprites.push({
      entry,
      dx: Math.cos(angle) * (100 + distance),
      dy: Math.sin(angle) * (100 + distance),
      size: 32 + size,
      spin: spin - 180,
    })
  }
  return sprites
}
