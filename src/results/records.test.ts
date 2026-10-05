import { describe, expect, it } from 'vitest'
import { recordResult, loadStats, type HistoryEntry } from '../state/storage.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { mostUsed, runsFor, summarize } from './records.ts'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(k: string) { return this.data.get(k) ?? null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

const run = (
  wins: number,
  mode: HistoryEntry['mode'] = 'normal',
  date = `d${wins}${mode}`,
  team = [1, 2, 3, 4, 5, 6],
): HistoryEntry => ({
  date,
  mode,
  team,
  wins,
  losses: 45 - wins,
})

const statsFrom = (...runs: HistoryEntry[]) => {
  const storage = new MemoryStorage()
  for (const r of runs) recordResult(storage, r)
  return loadStats(storage)
}

describe('summarize', () => {
  const stats = statsFrom(run(45), run(40), run(20), run(10, 'hard'), run(30, 'hard'))

  it('should total every mode on the all tab', () => {
    const s = summarize(stats, 'all')
    expect(s.runs).toBe(5)
    expect(s.perfect).toBe(1)
    expect(s.averageWins).toBeCloseTo((45 + 40 + 20 + 10 + 30) / 5)
    expect(s.fightWinRate).toBeCloseTo(145 / 225)
    expect(s.best?.wins).toBe(45)
  })

  it('should only count the selected mode on a mode tab', () => {
    const hard = summarize(stats, 'hard')
    expect(hard.runs).toBe(2)
    expect(hard.perfect).toBe(0)
    expect(hard.averageWins).toBe(20)
    expect(hard.best?.wins).toBe(30)
    expect(summarize(stats, 'normal').runs).toBe(3)
  })

  it('should list every rank from the highest down, with zero for ranks never earned', () => {
    expect(summarize(stats, 'all').ranks).toEqual([
      { title: 'Pokémon Master', sprite: '/trainers/pokemon-master.png', count: 1 },
      { title: 'Champion', sprite: '/trainers/champion.png', count: 1 },
      { title: 'Elite Four', sprite: '/trainers/elite-four.png', count: 0 },
      { title: 'Gym Leader', sprite: '/trainers/gym-leader.png', count: 1 },
      { title: 'Ace Trainer', sprite: '/trainers/ace-trainer.png', count: 1 },
      { title: 'Youngster', sprite: '/trainers/youngster.png', count: 1 },
    ])
  })

  it('should count ranks for the selected mode only', () => {
    const counts = summarize(stats, 'hard').ranks.filter((r) => r.count > 0).map((r) => r.title)
    expect(counts).toEqual(['Gym Leader', 'Youngster'])
  })

  it('should report no averages or best when nothing was played', () => {
    const s = summarize(statsFrom(), 'all')
    expect(s).toMatchObject({ runs: 0, best: null, averageWins: null, perfect: 0, fightWinRate: null })
    expect(s.ranks.every((r) => r.count === 0)).toBe(true)
  })

  it('should show the best of both modes on the all tab, preferring normal on a tie', () => {
    const tie = statsFrom(run(30, 'hard', 'h'), run(30, 'normal', 'n'))
    expect(summarize(tie, 'all').best?.date).toBe('n')
  })
})

describe('runsFor', () => {
  const stats = statsFrom(run(10, 'normal', 'a'), run(20, 'hard', 'b'), run(30, 'normal', 'c'))

  it('should list all runs newest first on the all tab', () => {
    expect(runsFor(stats, 'all').map((r) => r.date)).toEqual(['c', 'b', 'a'])
  })

  it('should filter to one mode', () => {
    expect(runsFor(stats, 'normal').map((r) => r.date)).toEqual(['c', 'a'])
    expect(runsFor(stats, 'hard').map((r) => r.date)).toEqual(['b'])
  })
})

describe('mostUsed', () => {
  const byId = new Map([1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => [id, mkEntry(id, 1, ['fire'], { name: `P${id}` })]))
  const stats = statsFrom(
    run(10, 'normal', 'a', [1, 2, 3, 4, 5, 6]),
    run(10, 'normal', 'b', [1, 2, 3, 4, 5, 7]),
    run(10, 'hard', 'c', [1, 2, 8, 4, 5, 7]),
    run(10, 'hard', 'd', [1, 9, 3, 4, 5, 6]),
  )

  it('should rank Pokémon by runs they were on the team, most first', () => {
    const top = mostUsed(stats, 'all', byId).map((m) => [m.entry.id, m.count])
    expect(top.slice(0, 3)).toEqual([[1, 4], [4, 4], [5, 4]])
  })

  it('should break ties by lower id so the order is stable', () => {
    expect(mostUsed(stats, 'all', byId).map((m) => m.entry.id).slice(0, 5)).toEqual([1, 4, 5, 2, 3])
  })

  it('should only count the selected mode on a mode tab', () => {
    const hard = mostUsed(stats, 'hard', byId)
    expect(hard.slice(0, 2).map((m) => [m.entry.id, m.count])).toEqual([[1, 2], [4, 2]])
    expect(hard.find((m) => m.entry.id === 6)?.count).toBe(1)
    expect(mostUsed(stats, 'normal', byId).find((m) => m.entry.id === 9)).toBeUndefined()
  })

  it('should limit the list and skip Pokémon missing from the data', () => {
    const partial = new Map([...byId].filter(([id]) => id !== 1))
    const top = mostUsed(stats, 'all', partial, 3)
    expect(top.map((m) => m.entry.id)).toEqual([4, 5, 2])
  })

  it('should be empty with no runs', () => {
    expect(mostUsed(statsFrom(), 'all', byId)).toEqual([])
  })
})
