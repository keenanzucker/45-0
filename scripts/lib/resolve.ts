import type { PokemonEntry } from '../../src/data/types.ts'
import type { ParsedMon } from './trainers.ts'

const REGION_WORDS: Record<string, string> = {
  alolan: 'alola',
  galarian: 'galar',
  hisuian: 'hisui',
  paldean: 'paldea',
}

// Words PokémonDB adds to form labels that never appear in a PokeAPI slug.
const GENERIC_LABEL_WORDS = new Set(['form', 'forme', 'mode', 'style', 'cloak', 'size'])

const defaultForm = (cands: PokemonEntry[], dex: number) =>
  cands.find((c) => c.id === dex) ?? cands.find((c) => c.id < 10000)

/** Resolves a PokémonDB card (dex number + optional form label) to a pool entry. */
export function resolvePokemonDbMon(mon: ParsedMon, pool: readonly PokemonEntry[]): PokemonEntry {
  const { dex, label } = mon
  if (dex === undefined) throw new Error(`PokémonDB entry ${mon.slug} has no dex number`)
  const cands = pool.filter((e) => e.speciesId === dex)
  if (cands.length === 0) throw new Error(`no Pokémon with dex number ${dex}`)

  const words = (label ?? '').toLowerCase().split(/\s+/).filter(Boolean)

  const regionWord = words.find((w) => w in REGION_WORDS)
  if (regionWord) {
    const region = REGION_WORDS[regionWord]
    const regional = cands.filter((c) => c.slug.includes(`-${region}`))
    if (regional.length === 0) throw new Error(`no ${label} form for dex ${dex}`)
    const score = (c: PokemonEntry) => words.filter((w) => w !== regionWord && c.slug.includes(w)).length
    return regional.reduce((best, c) => (score(c) > score(best) ? c : best))
  }

  if (words.includes('mega')) {
    const megas = cands.filter((c) => c.category === 'mega' && /-mega/.test(c.slug))
    if (megas.length === 0) throw new Error(`no Mega form for dex ${dex}`)
    const letter = /^[xyz]$/.test(words[words.length - 1]) ? words[words.length - 1] : undefined
    return (letter && megas.find((c) => c.slug.endsWith(`-mega-${letter}`))) || megas[0]
  }

  const def = defaultForm(cands, dex)
  if (!def) throw new Error(`no default form for dex ${dex}`)

  const distinctive = words.filter((w) => !GENERIC_LABEL_WORDS.has(w))
  if (distinctive.length > 0) {
    const alternate = cands.find(
      (c) => c !== def && distinctive.every((w) => c.slug.includes(w)),
    )
    if (alternate) return alternate
  }
  return def
}

const squash = (slug: string) => slug.replace(/-/g, '')

/**
 * Resolves a DittoBase team member (PokeAPI-style slug) to a pool entry. A bare
 * species slug maps to the species' default form; any other unknown form slug
 * throws rather than silently falling back to the default.
 */
export function resolveDittoBaseMon(mon: ParsedMon, pool: readonly PokemonEntry[]): PokemonEntry {
  const exact = pool.find((e) => e.slug === mon.slug)
  if (exact) return exact

  const squashed = squash(mon.slug)
  const sameLetters = pool.find((e) => squash(e.slug) === squashed)
  if (sameLetters) return sameLetters

  const defaultOfSpecies = pool.find((e) => e.id < 10000 && e.slug.startsWith(`${mon.slug}-`))
  if (defaultOfSpecies) return defaultOfSpecies
  throw new Error(`cannot resolve DittoBase Pokémon "${mon.slug}"`)
}

/** Order-insensitive equality of two teams of pool ids. */
export function sameTeam(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const sorted = (xs: readonly number[]) => [...xs].sort((x, y) => x - y)
  const [sa, sb] = [sorted(a), sorted(b)]
  return sa.every((v, i) => v === sb[i])
}
