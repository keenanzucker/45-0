import { POKEMON_TYPES } from '../data/types.ts'
import type { GameState, Mode } from '../engine/game.ts'
import { titleForWins } from '../results/titles.ts'

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>
type Remover = Pick<Storage, 'removeItem'>

const RUN_KEY = '45-0:run'
const STATS_KEY = '45-0:stats'
const RUN_VERSION = 1
export const HISTORY_LIMIT = 50
const PERFECT_WINS = 45

const MODES: readonly Mode[] = ['normal', 'hard']

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Structural check so a stale or hand-edited save can never crash the game. */
export function isValidState(x: unknown): x is GameState {
  if (!isRecord(x)) return false
  if (!MODES.includes(x.mode as Mode)) return false
  if (!isNum(x.seed) || !isNum(x.rng)) return false
  if (x.phase !== 'draft' && x.phase !== 'done') return false
  if (!Array.isArray(x.roster) || x.roster.length !== 6) return false
  if (!x.roster.every((id) => id === null || isNum(id))) return false
  if (!isRecord(x.rerollsLeft) || !isNum(x.rerollsLeft.era) || !isNum(x.rerollsLeft.type)) return false
  if (x.spin !== null) {
    if (!isRecord(x.spin) || !isNum(x.spin.era) || x.spin.era < 1 || x.spin.era > 9) return false
    if (!(POKEMON_TYPES as readonly unknown[]).includes(x.spin.type)) return false
  }
  return true
}

export function loadRun(storage: Reader): GameState | null {
  try {
    const raw = storage.getItem(RUN_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== RUN_VERSION) return null
    return isValidState(parsed.state) ? parsed.state : null
  } catch {
    return null
  }
}

export function saveRun(storage: Writer, state: GameState): void {
  try {
    storage.setItem(RUN_KEY, JSON.stringify({ version: RUN_VERSION, state }))
  } catch {
    // storage unavailable (private mode, quota): the game still works, it just won't resume
  }
}

export function clearRun(storage: Remover): void {
  try {
    storage.removeItem(RUN_KEY)
  } catch {
    // see saveRun
  }
}

export interface HistoryEntry {
  date: string
  mode: Mode
  /** Pokémon ids in slot order */
  team: number[]
  wins: number
  losses: number
}

/** Lifetime counters per mode; they keep growing after runs fall out of the capped history. */
export interface ModeTotals {
  runs: number
  /** Fights won and lost across all runs. */
  wins: number
  losses: number
  perfect: number
  /** Runs per rank title. */
  titles: Record<string, number>
  /** Runs each Pokémon (by entry id) was on the team. */
  picks: Record<number, number>
}

export interface StatsSave {
  best: Record<Mode, HistoryEntry | null>
  played: Record<Mode, number>
  totals: Record<Mode, ModeTotals>
  /** Newest first, capped at HISTORY_LIMIT */
  history: HistoryEntry[]
}

const emptyTotals = (): ModeTotals => ({ runs: 0, wins: 0, losses: 0, perfect: 0, titles: {}, picks: {} })

const addPicks = (picks: Record<number, number>, team: readonly number[]): Record<number, number> => {
  const next = { ...picks }
  for (const id of new Set(team)) next[id] = (next[id] ?? 0) + 1
  return next
}

const addRun = (t: ModeTotals, e: HistoryEntry): ModeTotals => {
  const title = titleForWins(e.wins)
  return {
    runs: t.runs + 1,
    wins: t.wins + e.wins,
    losses: t.losses + e.losses,
    perfect: t.perfect + (e.wins >= PERFECT_WINS ? 1 : 0),
    titles: { ...t.titles, [title]: (t.titles[title] ?? 0) + 1 },
    picks: addPicks(t.picks, e.team),
  }
}

const totalsFromHistory = (history: readonly HistoryEntry[]): Record<Mode, ModeTotals> => {
  const totals = { normal: emptyTotals(), hard: emptyTotals() }
  for (const e of history) totals[e.mode] = addRun(totals[e.mode], e)
  return totals
}

const emptyStats = (): StatsSave => ({
  best: { normal: null, hard: null },
  played: { normal: 0, hard: 0 },
  totals: { normal: emptyTotals(), hard: emptyTotals() },
  history: [],
})

export function loadStats(storage: Reader): StatsSave {
  try {
    const raw = storage.getItem(STATS_KEY)
    if (!raw) return emptyStats()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !isRecord(parsed.best) || !isRecord(parsed.played) || !Array.isArray(parsed.history)) {
      return emptyStats()
    }
    type SavedTotals = Omit<ModeTotals, 'picks'> & { picks?: ModeTotals['picks'] }
    const saved = parsed as unknown as Omit<StatsSave, 'totals'> & { totals?: Record<Mode, SavedTotals> }
    // Saves from before lifetime totals (or pick counts) existed only know their recent history.
    const fromHistory = totalsFromHistory(saved.history)
    const totals = saved.totals
      ? Object.fromEntries(
          MODES.map((m) => [m, { ...saved.totals![m], picks: saved.totals![m].picks ?? fromHistory[m].picks }]),
        )
      : fromHistory
    return { ...saved, totals: totals as StatsSave['totals'] }
  } catch {
    return emptyStats()
  }
}

export function recordResult(storage: Reader & Writer, entry: HistoryEntry): StatsSave {
  const stats = loadStats(storage)
  const best = stats.best[entry.mode]
  const next: StatsSave = {
    best: { ...stats.best, [entry.mode]: !best || entry.wins > best.wins ? entry : best },
    played: { ...stats.played, [entry.mode]: stats.played[entry.mode] + 1 },
    totals: { ...stats.totals, [entry.mode]: addRun(stats.totals[entry.mode], entry) },
    history: [entry, ...stats.history].slice(0, HISTORY_LIMIT),
  }
  try {
    storage.setItem(STATS_KEY, JSON.stringify(next))
  } catch {
    // see saveRun
  }
  return next
}
