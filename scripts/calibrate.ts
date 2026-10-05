/**
 * Calibration report for the simulation constants.
 *
 *   npm run calibrate -- --random 20000 --bot 300 --best 2 --param oppTargetBst=520
 *
 * Random drafts show the typical record, the greedy bot approximates a good
 * player, and the hill-climbed best team shows whether a perfect run is reachable.
 * Targets (SPEC §6.4): random mean ~20-25 of 45, strong drafts high 30s,
 * a perfect run ~0.1-1% of good-strategy games.
 */
import { readFileSync } from 'node:fs'
import type { GauntletFight, PokemonEntry } from '../src/data/types.ts'
import { DEFAULT_PARAMS, type SimParams } from '../src/engine/battle.ts'
import { buildPool } from '../src/engine/pool.ts'
import { createSimulator } from '../src/engine/simulate.ts'
import { bestPossibleTeam, bstDraft, greedyDraft, randomDraft } from './lib/draft.ts'

const args = process.argv.slice(2)
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const params: SimParams = { ...DEFAULT_PARAMS }
args.forEach((a, i) => {
  if (a !== '--param') return
  const [key, value] = args[i + 1].split('=')
  if (!(key in params)) throw new Error(`unknown param ${key}`)
  ;(params as unknown as Record<string, number>)[key] = Number(value)
})

const nRandom = flag('random', 20000)
const nBot = flag('bot', 300)
const nBst = flag('bst', 2000)
const nBest = flag('best', 2)
const seed0 = flag('seed', 1)

const entries = JSON.parse(readFileSync('public/data/pokemon.json', 'utf8')) as PokemonEntry[]
const gauntlet = JSON.parse(readFileSync('public/data/gauntlet.json', 'utf8')) as GauntletFight[]
const pool = buildPool(entries)
const sim = createSimulator(pool.byId, gauntlet, params)
const total = gauntlet.length

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]

function report(label: string, wins: number[]) {
  const sorted = [...wins].sort((a, b) => a - b)
  const mean = wins.reduce((a, b) => a + b, 0) / wins.length
  const sd = Math.sqrt(wins.reduce((a, b) => a + (b - mean) ** 2, 0) / wins.length)
  const perfect = wins.filter((w) => w === total).length
  const bins = new Array(Math.ceil((total + 1) / 5)).fill(0)
  for (const w of wins) bins[Math.floor(w / 5)]++
  console.log(`\n${label} (n=${wins.length})`)
  console.log(
    `  mean ${mean.toFixed(1)}  sd ${sd.toFixed(1)}  p5 ${pct(sorted, 5)}  p25 ${pct(sorted, 25)}  p50 ${pct(sorted, 50)}  p75 ${pct(sorted, 75)}  p95 ${pct(sorted, 95)}  max ${sorted[sorted.length - 1]}`,
  )
  console.log(
    `  >=35: ${((100 * wins.filter((w) => w >= 35).length) / wins.length).toFixed(1)}%  >=40: ${((100 * wins.filter((w) => w >= 40).length) / wins.length).toFixed(1)}%  perfect(${total}): ${((100 * perfect) / wins.length).toFixed(2)}% (${perfect})`,
  )
  console.log('  ' + bins.map((c, i) => `${i * 5}-${Math.min(total, i * 5 + 4)}:${((100 * c) / wins.length).toFixed(1)}%`).join('  '))
}

const time = <T>(label: string, fn: () => T): T => {
  const t0 = Date.now()
  const out = fn()
  console.log(`  [${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s]`)
  return out
}

console.log(`params ${JSON.stringify(params)}\nfights ${total}, playable ${pool.playable.length}`)

const randomRosters = time('random', () =>
  Array.from({ length: nRandom }, (_, i) => randomDraft(pool, seed0 + i).roster as number[]),
)
const random = randomRosters.map((r) => sim.wins(r))
report('random drafts', random)

// Per-fight and per-generation difficulty over random drafts.
const sample = randomRosters.slice(0, Math.min(1500, nRandom))
const fightWins = new Map<string, number>()
for (const roster of sample) {
  for (const f of sim.simulate(roster).fights) fightWins.set(f.fightId, (fightWins.get(f.fightId) ?? 0) + (f.won ? 1 : 0))
}
const rates = gauntlet.map((f) => ({ f, rate: (fightWins.get(f.id) ?? 0) / sample.length }))
const byRate = [...rates].sort((a, b) => a.rate - b.rate)
const fmt = (x: { f: GauntletFight; rate: number }) => `${x.f.id} ${(100 * x.rate).toFixed(0)}%`
console.log('\nhardest fights (random win rate):  ' + byRate.slice(0, 6).map(fmt).join(', '))
console.log('easiest fights:                    ' + byRate.slice(-6).reverse().map(fmt).join(', '))
console.log(
  'win rate by generation:            ' +
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((g) => {
        const r = rates.filter((x) => x.f.gen === g)
        return `G${g} ${((100 * r.reduce((a, x) => a + x.rate, 0)) / r.length).toFixed(0)}%`
      })
      .join('  '),
)
console.log(
  'win rate by opponent team size:   ' +
    [3, 4, 5, 6]
      .map((n) => {
        const r = rates.filter((x) => x.f.team.length === n)
        return r.length ? `${n}-mon ${((100 * r.reduce((a, x) => a + x.rate, 0)) / r.length).toFixed(0)}% (${r.length})` : ''
      })
      .filter(Boolean)
      .join('  '),
)
console.log(
  'win rate by tier:                  ' +
    ['e4', 'gym', 'champion']
      .map((t) => {
        const r = rates.filter((x) => x.f.tier === t)
        return r.length ? `${t} ${((100 * r.reduce((a, x) => a + x.rate, 0)) / r.length).toFixed(0)}%` : ''
      })
      .join('  '),
)

// Does any type or era dominate the top decile of random drafts?
const order = random.map((w, i) => [w, i] as const).sort((a, b) => b[0] - a[0])
const top = order.slice(0, Math.ceil(order.length / 10)).map(([, i]) => randomRosters[i])
const tally = (rosters: number[][], key: (e: PokemonEntry) => string[]) => {
  const counts = new Map<string, number>()
  let n = 0
  for (const r of rosters) for (const id of r) for (const k of key(pool.byId.get(id)!)) { counts.set(k, (counts.get(k) ?? 0) + 1); n++ }
  return { counts, n }
}
for (const [label, key] of [
  ['type', (e: PokemonEntry) => e.types as string[]],
  ['era', (e: PokemonEntry) => [`G${e.gen}`]],
  ['category', (e: PokemonEntry) => [e.category]],
] as const) {
  const all = tally(randomRosters, key)
  const best = tally(top, key)
  const lift = [...all.counts.keys()]
    .map((k) => ({ k, lift: (best.counts.get(k) ?? 0) / best.n / (all.counts.get(k)! / all.n) }))
    .sort((a, b) => b.lift - a.lift)
  console.log(
    `top-decile ${label} lift (1.0 = as common as overall): ` +
      lift.slice(0, 3).map((x) => `${x.k} ${x.lift.toFixed(2)}`).join(', ') + '  ...  ' +
      lift.slice(-3).map((x) => `${x.k} ${x.lift.toFixed(2)}`).join(', '),
  )
}

if (nBst > 0) {
  const bst = time('bst picker', () =>
    Array.from({ length: nBst }, (_, i) => sim.wins(bstDraft(pool, seed0 + i).roster as number[])),
  )
  report('BST picker (casual good player)', bst)
}

if (nBot > 0) {
  const bot = time('greedy bot (knows the scoring)', () =>
    Array.from({ length: nBot }, (_, i) => sim.wins(greedyDraft(pool, sim, seed0 + i).roster as number[])),
  )
  report('greedy bot (expert/oracle)', bot)
}

if (nBest > 0) {
  const best = time('best team', () => bestPossibleTeam(pool, sim, { restarts: nBest, seed: seed0 }))
  const r = sim.simulate(best.team)
  console.log(`\nbest possible team: ${r.wins}-${r.losses}  (value ${best.value.toFixed(2)})`)
  console.log('  ' + best.team.map((id) => pool.byId.get(id)!.name).join(', '))
  console.log('  lost to: ' + (r.fights.filter((f) => !f.won).map((f) => f.fightId).join(', ') || '-'))
}
