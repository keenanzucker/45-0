import { POKEMON_TYPES, type Category, type LegendKind, type PokemonEntry } from '../../src/data/types.ts'

export interface PoolIssue {
  id: number
  slug: string
  message: string
}

export function validatePool(
  entries: PokemonEntry[],
  opts: { spriteExists: (sprite: string) => boolean },
): PoolIssue[] {
  const issues: PoolIssue[] = []
  const seen = new Set<number>()

  for (const e of entries) {
    const add = (message: string) => issues.push({ id: e.id, slug: e.slug, message })

    if (seen.has(e.id)) add(`duplicate id ${e.id}`)
    seen.add(e.id)

    for (const [stat, value] of Object.entries(e.stats)) {
      if (!(value > 0)) add(`stat ${stat} must be positive (got ${value})`)
    }
    const sum = Object.values(e.stats).reduce((a, b) => a + b, 0)
    if (e.bst !== sum) add(`bst ${e.bst} does not match stats total ${sum}`)

    const distinct = new Set(e.types)
    if (e.types.length < 1 || e.types.length > 2 || distinct.size !== e.types.length) {
      add(`invalid types [${e.types.join(', ')}]`)
    }

    if (!opts.spriteExists(e.sprite)) add(`missing sprite file ${e.sprite}`)
  }
  return issues
}

export interface PoolSummary {
  total: number
  byCategory: Record<Category, number>
  byLegendKind: Record<LegendKind, number>
  byGen: Record<number, number>
  /** "<gen>:<type>" -> entries that would appear for that spin; dual types count under both. */
  comboCounts: Map<string, number>
  /** Combos with at least `minChoices` entries (a rough ceiling on valid spin results). */
  playableCombos: number
}

export function summarizePool(entries: PokemonEntry[], minChoices: number): PoolSummary {
  const byCategory: Record<Category, number> = { normal: 0, legend: 0, mega: 0 }
  const byLegendKind: Record<LegendKind, number> = {
    'box-art': 0,
    legendary: 0,
    mythical: 0,
    paradox: 0,
    'ultra-beast': 0,
  }
  const byGen: Record<number, number> = Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [i + 1, 0]),
  )
  const comboCounts = new Map<string, number>()

  for (const e of entries) {
    byCategory[e.category]++
    if (e.legendKind) byLegendKind[e.legendKind]++
    byGen[e.gen]++
    for (const type of e.types) {
      const key = `${e.gen}:${type}`
      comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1)
    }
  }

  const playableCombos = [...comboCounts.values()].filter((n) => n >= minChoices).length
  return { total: entries.length, byCategory, byLegendKind, byGen, comboCounts, playableCombos }
}

export const TOTAL_COMBOS = 9 * POKEMON_TYPES.length
