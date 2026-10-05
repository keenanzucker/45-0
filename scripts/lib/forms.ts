import type { Gen, PokemonEntry } from '../../src/data/types.ts'

export type Region = 'alola' | 'galar' | 'hisui' | 'paldea'

export type FormInfo =
  | { kind: 'default' }
  | { kind: 'regional'; region: Region }
  /** Mega Evolutions, Z-A Megas and Primal Reversion (primal: true); all use the Mega slot. */
  | { kind: 'mega'; primal?: boolean }
  /** Permanent non-regional forms (Origin, Therian, masks, ...) from the include list. */
  | { kind: 'alternate' }

const MEGA = /-mega(-[xyz])?$/
const PRIMAL = /-primal$/
const REGIONAL = /-(alola|galar|hisui|paldea)(-standard)?$/
const PALDEAN_TAUROS = /^tauros-paldea-/

const REGION_GEN: Record<Region, Gen> = { alola: 7, galar: 8, hisui: 8, paldea: 9 }

const REGION_ADJECTIVE: Record<Region, string> = {
  alola: 'Alolan',
  galar: 'Galarian',
  hisui: 'Hisuian',
  paldea: 'Paldean',
}

/**
 * Decides whether a PokeAPI pokemon variety belongs in the data, and what kind
 * of form it is. Other alternate forms are only kept when listed in `alternates`
 * (scripts/overrides/forms-include.json). Cosmetic and battle-only forms,
 * Gigantamax and Totem forms return null, as does anything in `excluded`
 * (scripts/overrides/forms-exclude.json): variants that duplicate another entry's
 * stats and types and would only clutter the pick list.
 */
export function classifyForm(
  slug: string,
  isDefault: boolean,
  alternates: ReadonlySet<string> = new Set(),
  excluded: ReadonlySet<string> = new Set(),
): FormInfo | null {
  if (isDefault) return { kind: 'default' }
  if (slug.includes('-totem') || excluded.has(slug)) return null
  if (alternates.has(slug)) return { kind: 'alternate' }
  if (MEGA.test(slug)) return { kind: 'mega' }
  if (PRIMAL.test(slug)) return { kind: 'mega', primal: true }
  const regional = REGIONAL.exec(slug)
  if (regional) return { kind: 'regional', region: regional[1] as Region }
  if (PALDEAN_TAUROS.test(slug)) return { kind: 'regional', region: 'paldea' }
  return null
}

const titleCase = (parts: string[]) =>
  parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')

export function formDisplayName(
  speciesName: string,
  speciesSlug: string,
  slug: string,
  form: FormInfo,
): string {
  if (form.kind === 'default') return speciesName
  const suffix = slug.slice(speciesSlug.length + 1).split('-')

  if (form.kind === 'alternate') return `${speciesName} (${titleCase(suffix)})`

  if (form.kind === 'mega' && form.primal) return `Primal ${speciesName}`

  if (form.kind === 'mega') {
    // "charizard-mega-x" -> letter X; "meowstic-female-mega" -> form word "Female".
    const letter = /^[xyz]$/.test(suffix[suffix.length - 1]) ? suffix[suffix.length - 1] : undefined
    const formWords = suffix.filter((p) => p !== 'mega' && p !== letter)
    const base = `Mega ${speciesName}${letter ? ` ${letter.toUpperCase()}` : ''}`
    return formWords.length > 0 ? `${base} (${titleCase(formWords)})` : base
  }

  const extra = suffix.slice(1).filter((p) => p !== 'standard')
  const base = `${REGION_ADJECTIVE[form.region]} ${speciesName}`
  return extra.length > 0 ? `${base} (${titleCase(extra)})` : base
}

/**
 * Megas that survive the exclude list as the only one of their species no longer need their form word
 * ("Mega Tatsugiri (Curly)" -> "Mega Tatsugiri"); species that keep several Megas keep the words.
 */
export function plainSoleMegaNames<T extends Pick<PokemonEntry, 'name' | 'category' | 'speciesId'>>(entries: readonly T[]): T[] {
  const megasPerSpecies = new Map<number, number>()
  for (const e of entries) {
    if (e.category === 'mega') megasPerSpecies.set(e.speciesId, (megasPerSpecies.get(e.speciesId) ?? 0) + 1)
  }
  return entries.map((e) => {
    const plain = e.category === 'mega' && megasPerSpecies.get(e.speciesId) === 1 ? /^(Mega [^()]+) \([^()]+\)$/.exec(e.name) : null
    return plain ? { ...e, name: plain[1] } : e
  })
}

/** Era of a form: regionals use the region's generation, everything else the species'. */
export function formGen(speciesGen: Gen, form: FormInfo): Gen {
  return form.kind === 'regional' ? REGION_GEN[form.region] : speciesGen
}

/** Include-list entries that match no PokeAPI variety, so a typo fails the build. */
export function unknownIncludes(
  included: ReadonlySet<string>,
  available: ReadonlySet<string>,
): string[] {
  return [...included].filter((slug) => !available.has(slug))
}
