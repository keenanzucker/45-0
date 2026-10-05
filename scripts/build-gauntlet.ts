/**
 * Builds public/data/gauntlet.json from PokémonDB and DittoBase trainer pages,
 * cross-checking the two. Raw HTML is cached in .cache/gauntlet.
 *
 *   npm run build:gauntlet
 *
 * Writes .cache/gauntlet-report.txt with every fight's status. Fights the two
 * sources disagree on (or that only one source covers) need a human look; fix
 * them via scripts/overrides/gauntlet-fixes.json (fight id -> pool slugs).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GauntletFight, PokemonEntry } from '../src/data/types.ts'
import { createCachedFetcher } from './lib/api.ts'
import { buildFight, type BuiltFight } from './lib/gauntlet.ts'
import { parseDittoBase, parsePokemonDb } from './lib/trainers.ts'
import { GAUNTLET } from './gauntlet-config.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_DIR = join(ROOT, '.cache', 'gauntlet')
const REPORT_FILE = join(ROOT, '.cache', 'gauntlet-report.txt')
const POKEMON_FILE = join(ROOT, 'public', 'data', 'pokemon.json')
const OUT_FILE = join(ROOT, 'public', 'data', 'gauntlet.json')
const FIXES_FILE = join(ROOT, 'scripts', 'overrides', 'gauntlet-fixes.json')

async function main() {
  const pool = JSON.parse(await readFile(POKEMON_FILE, 'utf8')) as PokemonEntry[]
  const fixes = JSON.parse(await readFile(FIXES_FILE, 'utf8')) as Record<string, string[]>
  const fetcher = createCachedFetcher({
    cacheDir: CACHE_DIR,
    headers: { 'user-agent': 'Mozilla/5.0 (45-0 data build; one-off trainer scrape)' },
    // pokemondb.net's robots.txt asks for a 2 second crawl delay; applied to both sites.
    minIntervalMs: 2000,
  })

  const built: BuiltFight[] = []
  for (const g of GAUNTLET) {
    const pdbUrl = `https://pokemondb.net/${g.pdbPath ?? `${g.game}/gymleaders-elitefour`}`
    const dittoUrl = `https://www.dittobase.com/${g.game}/gym-leaders-elite-four`
    console.log(`Gen ${g.gen} ${g.region} (${g.game})`)
    const pdb = parsePokemonDb(await fetcher.getText(pdbUrl))
    const ditto = parseDittoBase(await fetcher.getText(dittoUrl))
    for (const cfg of g.fights) {
      built.push(buildFight(cfg, { gen: g.gen, region: g.region, game: g.game }, pdb, ditto, pool, fixes))
    }
  }

  const fights: GauntletFight[] = built.map((b) => b.fight)
  await mkdir(dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, `[\n${fights.map((f) => JSON.stringify(f)).join(',\n')}\n]\n`)

  const nameOf = (id: number) => pool.find((e) => e.id === id)!.name
  const lines = built.map((b) => {
    const f = b.fight
    const head = `${f.id.padEnd(14)} [${b.status}] ${f.region} ${f.name} (${f.tier}${f.variant ? `, ${f.variant}` : ''})`
    return [head, `    ${f.team.map(nameOf).join(', ')}`, ...b.notes.map((n) => `    ! ${n}`)].join('\n')
  })
  const counts = built.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.status]: (acc[b.status] ?? 0) + 1 }), {})
  const report = [`fights: ${built.length} ${JSON.stringify(counts)}`, '', ...lines].join('\n')
  await writeFile(REPORT_FILE, report + '\n')
  console.log(report)
  console.log(`\nWrote ${fights.length} fights to ${OUT_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
