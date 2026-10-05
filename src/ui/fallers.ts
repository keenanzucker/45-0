import type { PokemonEntry } from '../data/types.ts'
import { nextFloat, nextInt, seedRng } from '../engine/rng.ts'

export interface Faller {
  entry: PokemonEntry
  /** Left edge, percent of the screen width. */
  left: number
  /** Sprite size in px. */
  size: number
  /** Seconds to cross the screen. */
  duration: number
  /** Seconds, zero or negative so the scene is already mid-fall on load. */
  delay: number
  /** Seconds per side-to-side swing. */
  sway: number
}

const RIGHT_EDGE = 92

/** Distinct Pokémon spread across the width, each with its own speed and size; same seed, same scene. */
export function makeFallers(entries: readonly PokemonEntry[], count: number, seed: number): Faller[] {
  const pool = [...entries]
  const total = Math.min(count, pool.length)
  const slot = RIGHT_EDGE / Math.max(total, 1)
  let rng = seedRng(seed)
  const fallers: Faller[] = []
  for (let i = 0; i < total; i++) {
    let pick: number, jitter: number, size: number, duration: number, phase: number, sway: number
    ;[pick, rng] = nextInt(rng, pool.length)
    ;[jitter, rng] = nextFloat(rng)
    ;[size, rng] = nextInt(rng, 26)
    ;[duration, rng] = nextInt(rng, 9)
    ;[phase, rng] = nextFloat(rng)
    ;[sway, rng] = nextInt(rng, 3)
    const [entry] = pool.splice(pick, 1)
    fallers.push({
      entry,
      left: i * slot + jitter * slot,
      size: 34 + size,
      duration: 8 + duration,
      delay: -phase * (8 + duration),
      sway: 2 + sway,
    })
  }
  return fallers
}

/** A Pokémon that isn't already falling, to replace one that has left the screen; null if every one is showing. */
export function pickReplacement(
  entries: readonly PokemonEntry[],
  shownIds: ReadonlySet<number>,
  rng: number,
): [PokemonEntry | null, number] {
  const candidates = entries.filter((e) => !shownIds.has(e.id))
  if (candidates.length === 0) return [null, rng]
  const [i, next] = nextInt(rng, candidates.length)
  return [candidates[i], next]
}
