import { beforeEach, describe, expect, it } from 'vitest'
import { buildPool } from '../engine/pool.ts'
import { newGame, type GameState } from '../engine/game.ts'
import { gridEntries } from '../engine/testUtils.ts'
import { HISTORY_LIMIT, clearRun, isValidState, loadRun, loadStats, recordResult, saveRun, type HistoryEntry } from './storage.ts'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(k: string) { return this.data.get(k) ?? null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

const pool = buildPool(gridEntries([1, 2], ['fire', 'water', 'grass'], 8))
const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  date: '2026-10-01T00:00:00.000Z',
  mode: 'normal',
  team: [1, 2, 3, 4, 5, 6],
  wins: 20,
  losses: 25,
  ...over,
})

describe('run persistence', () => {
  let storage: MemoryStorage
  beforeEach(() => { storage = new MemoryStorage() })

  it('should round trip a game state', () => {
    const state = newGame(pool, 42, 'hard')
    saveRun(storage, state)
    expect(loadRun(storage)).toEqual(state)
  })

  it('should return null when nothing is saved and after clearing', () => {
    expect(loadRun(storage)).toBeNull()
    saveRun(storage, newGame(pool, 1, 'normal'))
    clearRun(storage)
    expect(loadRun(storage)).toBeNull()
  })

  it('should ignore corrupt or incompatible saves', () => {
    storage.setItem('45-0:run', '{not json')
    expect(loadRun(storage)).toBeNull()
    storage.setItem('45-0:run', JSON.stringify({ version: 99, state: newGame(pool, 1, 'normal') }))
    expect(loadRun(storage)).toBeNull()
    storage.setItem('45-0:run', JSON.stringify({ version: 1, state: { mode: 'normal' } }))
    expect(loadRun(storage)).toBeNull()
  })

  it('should survive a storage that throws', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
    expect(loadRun(broken)).toBeNull()
    expect(() => saveRun(broken, newGame(pool, 1, 'normal'))).not.toThrow()
    expect(loadStats(broken).history).toEqual([])
  })
})

describe('isValidState', () => {
  const good = newGame(pool, 3, 'normal')

  it('should accept a real state and reject malformed ones', () => {
    expect(isValidState(good)).toBe(true)
    expect(isValidState(null)).toBe(false)
    expect(isValidState({ ...good, mode: 'easy' })).toBe(false)
    expect(isValidState({ ...good, roster: [1, 2] })).toBe(false)
    expect(isValidState({ ...good, phase: 'paused' })).toBe(false)
    expect(isValidState({ ...good, rerollsLeft: { era: 1 } })).toBe(false)
    expect(isValidState({ ...good, spin: { era: 12, type: 'fire' } })).toBe(false)
  })

  it('should accept a finished state with no spin', () => {
    const done: GameState = { ...good, spin: null, phase: 'done', roster: [1, 2, 3, 4, 5, 6] }
    expect(isValidState(done)).toBe(true)
  })
})

describe('stats', () => {
  let storage: MemoryStorage
  beforeEach(() => { storage = new MemoryStorage() })

  it('should start empty', () => {
    const none = { runs: 0, wins: 0, losses: 0, perfect: 0, titles: {}, picks: {} }
    expect(loadStats(storage)).toEqual({
      best: { normal: null, hard: null },
      played: { normal: 0, hard: 0 },
      totals: { normal: none, hard: none },
      history: [],
    })
  })

  it('should track best record separately per mode, and count games', () => {
    recordResult(storage, entry({ wins: 20 }))
    recordResult(storage, entry({ wins: 30 }))
    recordResult(storage, entry({ wins: 25 }))
    recordResult(storage, entry({ wins: 10, mode: 'hard' }))
    const s = loadStats(storage)
    expect(s.best.normal?.wins).toBe(30)
    expect(s.best.hard?.wins).toBe(10)
    expect(s.played).toEqual({ normal: 3, hard: 1 })
  })

  it('should keep the earlier run when a later one only ties the best', () => {
    recordResult(storage, entry({ wins: 30, date: 'first' }))
    recordResult(storage, entry({ wins: 30, date: 'second' }))
    expect(loadStats(storage).best.normal?.date).toBe('first')
  })

  it('should list history newest first and cap it', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) recordResult(storage, entry({ date: `d${i}`, wins: i % 40 }))
    const h = loadStats(storage).history
    expect(h).toHaveLength(HISTORY_LIMIT)
    expect(h[0].date).toBe(`d${HISTORY_LIMIT + 4}`)
    expect(loadStats(storage).played.normal).toBe(HISTORY_LIMIT + 5)
  })

  it('should return the updated stats from recordResult', () => {
    expect(recordResult(storage, entry({ wins: 12 })).best.normal?.wins).toBe(12)
  })

  it('should keep 50 recent runs', () => {
    expect(HISTORY_LIMIT).toBe(50)
  })
})

describe('lifetime totals', () => {
  let storage: MemoryStorage
  beforeEach(() => { storage = new MemoryStorage() })

  it('should add up runs, fights won and lost, perfect runs and titles per mode', () => {
    recordResult(storage, entry({ wins: 45, losses: 0 }))
    recordResult(storage, entry({ wins: 41, losses: 4 }))
    recordResult(storage, entry({ wins: 41, losses: 4 }))
    recordResult(storage, entry({ wins: 10, losses: 35, mode: 'hard' }))
    const { totals } = loadStats(storage)
    expect(totals.normal).toEqual({
      runs: 3,
      wins: 127,
      losses: 8,
      perfect: 1,
      titles: { 'Pokémon Master': 1, Champion: 2 },
      picks: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 },
    })
    expect(totals.hard).toEqual({
      runs: 1,
      wins: 10,
      losses: 35,
      perfect: 0,
      titles: { Youngster: 1 },
      picks: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
    })
  })

  it('should keep counting after runs fall out of the history', () => {
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) recordResult(storage, entry({ wins: 45, losses: 0 }))
    const s = loadStats(storage)
    expect(s.history).toHaveLength(HISTORY_LIMIT)
    expect(s.totals.normal.runs).toBe(HISTORY_LIMIT + 3)
    expect(s.totals.normal.perfect).toBe(HISTORY_LIMIT + 3)
  })

  it('should rebuild totals from the history of a save made before totals existed', () => {
    const old = {
      best: { normal: entry({ wins: 41, losses: 4 }), hard: null },
      played: { normal: 30, hard: 0 },
      history: [entry({ wins: 41, losses: 4 }), entry({ wins: 20, losses: 25 })],
    }
    storage.setItem('45-0:stats', JSON.stringify(old))
    const s = loadStats(storage)
    expect(s.played.normal).toBe(30)
    expect(s.totals.normal).toEqual({
      runs: 2,
      wins: 61,
      losses: 29,
      perfect: 0,
      titles: { Champion: 1, 'Ace Trainer': 1 },
      picks: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 },
    })
    expect(s.totals.hard.runs).toBe(0)
  })

  it('should count each Pokémon once per run it was on the team, per mode', () => {
    recordResult(storage, entry({ team: [1, 2, 3, 4, 5, 6] }))
    recordResult(storage, entry({ team: [1, 2, 3, 4, 5, 7] }))
    recordResult(storage, entry({ team: [1, 8, 9, 10, 11, 12], mode: 'hard' }))
    const { totals } = loadStats(storage)
    expect(totals.normal.picks).toMatchObject({ 1: 2, 6: 1, 7: 1 })
    expect(totals.hard.picks).toEqual({ 1: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 })
  })

  it('should keep counting picks after runs fall out of the history', () => {
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) recordResult(storage, entry())
    expect(loadStats(storage).totals.normal.picks[1]).toBe(HISTORY_LIMIT + 3)
  })

  it('should add pick counts from the history to totals saved before picks existed', () => {
    const totals = { runs: 30, wins: 600, losses: 750, perfect: 0, titles: { 'Gym Leader': 30 } }
    storage.setItem(
      '45-0:stats',
      JSON.stringify({
        best: { normal: null, hard: null },
        played: { normal: 30, hard: 0 },
        totals: { normal: totals, hard: { ...totals, runs: 0, wins: 0, losses: 0, titles: {} } },
        history: [entry(), entry({ team: [1, 2, 3, 4, 5, 7] })],
      }),
    )
    const s = loadStats(storage)
    expect(s.totals.normal.runs).toBe(30)
    expect(s.totals.normal.picks).toMatchObject({ 1: 2, 6: 1, 7: 1 })
    expect(s.totals.hard.picks).toEqual({})
  })

  it('should keep adding to migrated totals', () => {
    storage.setItem(
      '45-0:stats',
      JSON.stringify({ best: { normal: null, hard: null }, played: { normal: 1, hard: 0 }, history: [entry({ wins: 20, losses: 25 })] }),
    )
    const s = recordResult(storage, entry({ wins: 45, losses: 0 }))
    expect(s.totals.normal).toMatchObject({ runs: 2, wins: 65, perfect: 1 })
  })
})
