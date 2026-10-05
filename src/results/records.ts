import type { Mode } from '../engine/game.ts'
import type { HistoryEntry, ModeTotals, StatsSave } from '../state/storage.ts'
import type { PokemonEntry } from '../data/types.ts'
import { RANKS } from './titles.ts'

export type RecordsTab = 'all' | Mode

export interface RecordsSummary {
  runs: number
  best: HistoryEntry | null
  averageWins: number | null
  perfect: number
  /** Share (0..1) of all fights won. */
  fightWinRate: number | null
  /** Every rank, highest first, with how many runs earned it (0 for ranks never earned). */
  ranks: { title: string; sprite: string; count: number }[]
}

const modesFor = (tab: RecordsTab): Mode[] => (tab === 'all' ? ['normal', 'hard'] : [tab])

export function summarize(stats: StatsSave, tab: RecordsTab): RecordsSummary {
  const modes = modesFor(tab)
  const totals: ModeTotals[] = modes.map((m) => stats.totals[m])
  const sum = (pick: (t: ModeTotals) => number) => totals.reduce((s, t) => s + pick(t), 0)
  const counted = sum((t) => t.runs)
  const wins = sum((t) => t.wins)
  const fights = wins + sum((t) => t.losses)
  const titleCounts = (title: string) => sum((t) => t.titles[title] ?? 0)

  let best: HistoryEntry | null = null
  for (const m of modes) {
    const candidate = stats.best[m]
    if (candidate && (!best || candidate.wins > best.wins)) best = candidate
  }

  return {
    runs: modes.reduce((s, m) => s + stats.played[m], 0),
    best,
    averageWins: counted > 0 ? wins / counted : null,
    perfect: sum((t) => t.perfect),
    fightWinRate: fights > 0 ? wins / fights : null,
    ranks: RANKS.map((r) => ({ ...r, count: titleCounts(r.title) })),
  }
}

/** Recent runs, newest first. */
export const runsFor = (stats: StatsSave, tab: RecordsTab): HistoryEntry[] =>
  stats.history.filter((h) => tab === 'all' || h.mode === tab)

export interface MostUsed {
  entry: PokemonEntry
  /** Runs the Pokémon was on the team. */
  count: number
}

/** Pokémon by lifetime team appearances, most first; ties go to the lower id. Unknown ids are skipped. */
export function mostUsed(stats: StatsSave, tab: RecordsTab, byId: ReadonlyMap<number, PokemonEntry>, limit = Infinity): MostUsed[] {
  const counts = new Map<number, number>()
  for (const m of modesFor(tab)) {
    for (const [id, n] of Object.entries(stats.totals[m].picks)) counts.set(Number(id), (counts.get(Number(id)) ?? 0) + n)
  }
  return [...counts]
    .flatMap(([id, count]) => (byId.has(id) ? [{ entry: byId.get(id)!, count }] : []))
    .sort((a, b) => b.count - a.count || a.entry.id - b.entry.id)
    .slice(0, limit)
}
