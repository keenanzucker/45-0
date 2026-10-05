/**
 * Builds public/data/pokemon.json and public/sprites/ from PokeAPI.
 * Raw API responses are cached in .cache/pokeapi so reruns don't hit the network.
 *
 *   npm run build:pokemon
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCachedFetcher, mapLimit } from './lib/api.ts'
import { finalSpeciesInChain, type ChainNode } from './lib/evolution.ts'
import { buildEntry, pickSpriteUrl, type ApiPokemon, type ApiSpecies, type BuildOverrides } from './lib/entry.ts'
import { classifyForm, plainSoleMegaNames, unknownIncludes } from './lib/forms.ts'
import { summarizePool, TOTAL_COMBOS, validatePool } from './lib/validate.ts'

const API = 'https://pokeapi.co/api/v2'
const CONCURRENCY = 8
const MIN_CHOICES = 5

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_DIR = join(ROOT, '.cache', 'pokeapi')
const REPORT_FILE = join(ROOT, '.cache', 'pokemon-report.txt')
const DATA_FILE = join(ROOT, 'public', 'data', 'pokemon.json')
const SPRITE_DIR = join(ROOT, 'public', 'sprites')

interface SpeciesWithVarieties extends ApiSpecies {
  varieties: { is_default: boolean; pokemon: { name: string; url: string } }[]
  evolution_chain: { url: string } | null
}

const readList = async (name: string) =>
  new Set(
    JSON.parse(await readFile(join(ROOT, 'scripts', 'overrides', `${name}.json`), 'utf8')) as string[],
  )

async function loadOverrides(): Promise<BuildOverrides> {
  return {
    category: {
      restricted: await readList('restricted-legendaries'),
      paradox: await readList('paradox'),
      ultraBeasts: await readList('ultra-beasts'),
    },
    baseFinal: await readList('final-evolution-overrides'),
    starters: await readList('starters'),
  }
}

async function main() {
  const fetcher = createCachedFetcher({ cacheDir: CACHE_DIR })
  const overrides = await loadOverrides()
  const alternates = await readList('forms-include')
  const excludedForms = await readList('forms-exclude')
  const log = (msg: string) => console.log(msg)

  log('Fetching species list…')
  const list = await fetcher.getJson<{ results: { name: string; url: string }[] }>(
    `${API}/pokemon-species?limit=3000`,
  )

  log(`Fetching ${list.results.length} species…`)
  const species = await mapLimit(list.results, CONCURRENCY, (r) =>
    fetcher.getJson<SpeciesWithVarieties>(r.url),
  )

  const chainUrls = [...new Set(species.flatMap((s) => (s.evolution_chain ? [s.evolution_chain.url] : [])))]
  log(`Fetching ${chainUrls.length} evolution chains…`)
  const chains = await mapLimit(chainUrls, CONCURRENCY, (url) =>
    fetcher.getJson<{ chain: ChainNode }>(url),
  )
  const finalsByChain = new Map(chainUrls.map((url, i) => [url, finalSpeciesInChain(chains[i].chain)]))

  const unknown = unknownIncludes(
    alternates,
    new Set(species.flatMap((s) => s.varieties.map((v) => v.pokemon.name))),
  )
  if (unknown.length > 0) throw new Error(`forms-include.json has unknown slugs: ${unknown.join(', ')}`)
  const unknownExcluded = unknownIncludes(
    excludedForms,
    new Set(species.flatMap((s) => s.varieties.map((v) => v.pokemon.name))),
  )
  if (unknownExcluded.length > 0) {
    throw new Error(`forms-exclude.json has unknown slugs: ${unknownExcluded.join(', ')}`)
  }

  // Decide which varieties to fetch before touching the network again.
  const work: { species: SpeciesWithVarieties; slug: string; url: string }[] = []
  const excluded: string[] = []
  for (const s of species) {
    for (const v of s.varieties) {
      const form = classifyForm(v.pokemon.name, v.is_default, alternates, excludedForms)
      if (!form) {
        excluded.push(v.pokemon.name)
        continue
      }
      work.push({ species: s, slug: v.pokemon.name, url: v.pokemon.url })
    }
  }

  log(`Fetching ${work.length} Pokémon…`)
  const spriteUrls = new Map<number, string>()
  const built = await mapLimit(work, CONCURRENCY, async ({ species: s, slug, url }) => {
    const pokemon = await fetcher.getJson<ApiPokemon>(url)
    const form = classifyForm(slug, s.varieties.find((v) => v.pokemon.name === slug)!.is_default, alternates, excludedForms)!
    const chainFinals = s.evolution_chain
      ? (finalsByChain.get(s.evolution_chain.url) ?? new Set<string>())
      : new Set([s.name])
    const entry = buildEntry({ pokemon, species: s, form, chainFinals, overrides })
    spriteUrls.set(entry.id, pickSpriteUrl(pokemon.sprites)!)
    return entry
  })
  const entries = plainSoleMegaNames(built.sort((a, b) => a.id - b.id))

  await mkdir(SPRITE_DIR, { recursive: true })
  const missing = entries.filter((e) => !existsSync(join(ROOT, 'public', e.sprite)))
  log(`Downloading ${missing.length} sprites (${entries.length - missing.length} already present)…`)
  await mapLimit(missing, CONCURRENCY, async (e) => {
    const png = await fetcher.getBinary(spriteUrls.get(e.id)!)
    await writeFile(join(ROOT, 'public', e.sprite), png)
  })

  const keep = new Set(entries.map((e) => e.sprite.split('/').pop()))
  const stale = (await readdir(SPRITE_DIR)).filter((f) => f.endsWith('.png') && !keep.has(f))
  await Promise.all(stale.map((f) => rm(join(SPRITE_DIR, f))))
  if (stale.length > 0) log(`Removed ${stale.length} stale sprite(s)`)

  await mkdir(dirname(DATA_FILE), { recursive: true })
  await writeFile(DATA_FILE, `[\n${entries.map((e) => JSON.stringify(e)).join(',\n')}\n]\n`)

  const issues = validatePool(entries, {
    spriteExists: (sprite) => existsSync(join(ROOT, 'public', sprite)),
  })
  // The game pool is final evolutions only; everything else is kept for future modes.
  const summary = summarizePool(entries.filter((e) => e.isFinal), MIN_CHOICES)

  const report = [
    `entries: ${entries.length} total, ${summary.total} in the game pool (isFinal)`,
    `by category: ${JSON.stringify(summary.byCategory)}`,
    `legend kinds: ${JSON.stringify(summary.byLegendKind)}`,
    `by gen: ${JSON.stringify(summary.byGen)}`,
    `playable (gen,type) combos with >= ${MIN_CHOICES} entries: ${summary.playableCombos} / ${TOTAL_COMBOS}`,
    '',
    `excluded varieties (${excluded.length}):`,
    ...excluded,
  ].join('\n')
  await writeFile(REPORT_FILE, report + '\n')

  log(report.split('\n\n')[0])
  log(`Full report: ${REPORT_FILE}`)
  if (issues.length > 0) {
    console.error(`\n${issues.length} validation issue(s):`)
    for (const i of issues) console.error(`  #${i.id} ${i.slug}: ${i.message}`)
    process.exit(1)
  }
  log(`Wrote ${entries.length} entries to ${DATA_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
