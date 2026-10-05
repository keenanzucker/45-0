import { ERAS, TYPES, selectableCount, validSpins, type Pool, type Spin } from './pool.ts'
import { pickOne } from './rng.ts'
import type { Roster } from './slots.ts'

/**
 * A spin must offer at least this many selectable species. Two keeps thin combos
 * in play (a good reason to use a reroll) while ruling out spins with no real
 * choice, including ones whose only entries can't fill any open slot.
 */
export const MIN_CHOICES = 2

/** Prefers combos with enough choices, falling back to any combo with one selectable entry. */
function validWithFallback(pool: Pool, roster: Roster, minChoices: number): Spin[] {
  const strong = validSpins(pool, roster, minChoices)
  return strong.length > 0 ? strong : validSpins(pool, roster, 1)
}

export function drawSpin(
  pool: Pool,
  roster: Roster,
  rng: number,
  minChoices = MIN_CHOICES,
): [Spin, number] {
  const options = validWithFallback(pool, roster, minChoices)
  if (options.length === 0) throw new Error('no valid spin available')
  return pickOne(rng, options)
}

/**
 * Combos reachable by rerolling just the era or just the type of the current
 * spin. Unlike a fresh spin there is no thin-combo fallback: if no option has
 * enough choices the reroll is simply unavailable.
 */
export function rerollOptions(
  pool: Pool,
  roster: Roster,
  spin: Spin,
  kind: 'era' | 'type',
  minChoices = MIN_CHOICES,
): Spin[] {
  const candidates: Spin[] =
    kind === 'era'
      ? ERAS.filter((era) => era !== spin.era).map((era) => ({ era, type: spin.type }))
      : TYPES.filter((type) => type !== spin.type).map((type) => ({ era: spin.era, type }))
  return candidates.filter((c) => selectableCount(pool, c, roster) >= minChoices)
}

export function drawReroll(
  pool: Pool,
  roster: Roster,
  spin: Spin,
  kind: 'era' | 'type',
  rng: number,
  minChoices = MIN_CHOICES,
): [Spin, number] | null {
  const options = rerollOptions(pool, roster, spin, kind, minChoices)
  return options.length === 0 ? null : pickOne(rng, options)
}
