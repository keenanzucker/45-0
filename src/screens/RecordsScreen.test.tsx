// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkEntry } from '../engine/testUtils.ts'
import { loadStats, recordResult, type HistoryEntry, type StatsSave } from '../state/storage.ts'
import { RecordsScreen } from './RecordsScreen.tsx'

afterEach(cleanup)

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(k: string) { return this.data.get(k) ?? null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

const names = ['Aron', 'Bolt', 'Cleft', 'Drake', 'Ember', 'Fang', 'Gale', 'Hexa']
const mons = names.map((name, i) => ({ ...mkEntry(i + 1, 1, ['fire'], { name, bst: 400 + i }) }))
const byId = new Map(mons.map((e) => [e.id, e]))

const run = (wins: number, mode: HistoryEntry['mode'], team: number[], date: string): HistoryEntry => ({
  date,
  mode,
  team,
  wins,
  losses: 45 - wins,
})

const statsFrom = (...runs: HistoryEntry[]): StatsSave => {
  const storage = new MemoryStorage()
  for (const r of runs) recordResult(storage, r)
  return loadStats(storage)
}

const stats = statsFrom(
  run(40, 'normal', [1, 2, 3, 4, 5, 6], '2026-09-01T10:00:00Z'),
  run(20, 'hard', [3, 4, 5, 6, 7, 8], '2026-09-02T10:00:00Z'),
  run(45, 'normal', [1, 2, 3, 4, 5, 8], '2026-09-03T10:00:00Z'),
)

const setup = (s: StatsSave = stats, onBack = vi.fn(), onViewRun = vi.fn()) => {
  const user = userEvent.setup()
  const utils = render(<RecordsScreen stats={s} byId={byId} onBack={onBack} onViewRun={onViewRun} />)
  return { user, onBack, onViewRun, ...utils }
}

const stat = (label: string) => {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.nextElementSibling!.textContent
}

describe('RecordsScreen summary', () => {
  it('should show runs, best, average, perfect runs and fight win rate across all modes', () => {
    setup()
    expect(stat('Runs')).toBe('3')
    expect(stat('Best')).toBe('45–0')
    expect(stat('Average')).toBe('35.0')
    expect(stat('Perfect')).toBe('1')
    expect(stat('Fights won')).toBe('78%')
  })

  it('should chart runs per rank, highest rank first, including ranks never earned', () => {
    setup()
    const rows = within(screen.getByRole('list', { name: /results by rank/i })).getAllByRole('listitem')
    expect(rows.map((r) => r.querySelector('.rank__title')!.textContent)).toEqual([
      'Pokémon Master',
      'Champion',
      'Elite Four',
      'Gym Leader',
      'Ace Trainer',
      'Youngster',
    ])
    expect(rows.map((r) => r.querySelector('.rank__count')!.textContent)).toEqual(['1', '1', '0', '0', '1', '0'])
    expect(rows[0].querySelector('img')!.getAttribute('src')).toBe('/trainers/pokemon-master.png')
  })

  it('should scale rank bar heights to the most common rank', () => {
    const many = statsFrom(
      run(41, 'normal', [1, 2, 3, 4, 5, 6], 'a'),
      run(42, 'normal', [1, 2, 3, 4, 5, 6], 'b'),
      run(43, 'normal', [1, 2, 3, 4, 5, 6], 'c'),
      run(10, 'normal', [1, 2, 3, 4, 5, 6], 'd'),
    )
    setup(many)
    const bars = [...screen.getByRole('list', { name: /results by rank/i }).querySelectorAll<HTMLElement>('.rank__bar')]
    expect(bars.map((b) => b.style.height)).toEqual(['0%', '100%', '0%', '0%', '0%', '33%'])
  })

  it('should filter the summary with the Normal and Hard tabs', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('tab', { name: /^hard/i }))
    expect(stat('Runs')).toBe('1')
    expect(stat('Best')).toBe('20–25')
    await user.click(screen.getByRole('tab', { name: /^normal/i }))
    expect(stat('Runs')).toBe('2')
  })

  it('should select the All tab first', () => {
    setup()
    expect(screen.getByRole('tab', { name: /^all/i }).getAttribute('aria-selected')).toBe('true')
  })

  it('should show placeholders and an empty message with no runs', () => {
    setup(statsFrom())
    expect(stat('Runs')).toBe('0')
    expect(stat('Best')).toBe('–')
    expect(stat('Average')).toBe('–')
    expect(stat('Fights won')).toBe('–')
    expect(screen.getByText(/no runs yet/i)).toBeTruthy()
  })
})

describe('RecordsScreen most used', () => {
  it('should show the top three Pokémon with how many runs they were on the team', () => {
    setup()
    const spots = within(screen.getByRole('list', { name: /most used/i })).getAllByRole('listitem')
    expect(spots).toHaveLength(3)
    expect(spots.map((s) => s.querySelector('.podium__name')!.textContent)).toEqual(['Cleft', 'Drake', 'Ember'])
    expect(spots.map((s) => s.querySelector('.podium__count')!.textContent)).toEqual(['×3', '×3', '×3'])
    expect(spots.map((s) => within(s as HTMLElement).getByRole('img', { name: /place$/ }).getAttribute('aria-label'))).toEqual([
      '1st place',
      '2nd place',
      '3rd place',
    ])
    expect(spots.every((s) => s.querySelector('.podium__step') !== null)).toBe(true)
    expect(spots[0].querySelector('img')).not.toBeNull()
  })

  it('should follow the selected mode tab', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('tab', { name: /^normal/i }))
    const spots = within(screen.getByRole('list', { name: /most used/i })).getAllByRole('listitem')
    expect(spots.map((s) => s.querySelector('.podium__name')!.textContent)).toEqual(['Aron', 'Bolt', 'Cleft'])
    expect(spots.map((s) => s.querySelector('.podium__count')!.textContent)).toEqual(['×2', '×2', '×2'])
  })

  it('should be hidden when there are no runs', () => {
    setup(statsFrom())
    expect(screen.queryByRole('list', { name: /most used/i })).toBeNull()
  })

  it('should fill as many spots as there are Pokémon', () => {
    const tiny = statsFrom(run(10, 'normal', [1], 'a'))
    setup(tiny)
    expect(within(screen.getByRole('list', { name: /most used/i })).getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('RecordsScreen runs', () => {
  it('should list recent runs newest first with their records', () => {
    const { container } = setup()
    const rows = [...container.querySelectorAll('.runs .run')].map((r) => r.querySelector('summary')!.textContent!)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('45–0')
    expect(rows[1]).toContain('20–25')
    expect(rows[2]).toContain('40–5')
  })

  it('should filter the run list with the tabs', async () => {
    const { user, container } = setup()
    await user.click(screen.getByRole('tab', { name: /^hard/i }))
    expect(container.querySelectorAll('.runs .run')).toHaveLength(1)
  })

  it('should reveal the team with names, BST and the overall record when a run is expanded', async () => {
    const { user, container } = setup()
    const row = container.querySelectorAll<HTMLElement>('.runs .run')[2]
    await user.click(row.querySelector('summary')!)
    const team = within(row).getAllByRole('listitem')
    expect(team.map((li) => li.textContent)).toEqual(
      [1, 2, 3, 4, 5, 6].map((id) => expect.stringContaining(`${byId.get(id)!.name}`)),
    )
    expect(team[0].textContent).toContain('400')
    expect(within(row).getByText(/40–5/, { selector: '.run__foot' })).toBeTruthy()
  })

  it('should also show the best run, expandable, above the recent runs', async () => {
    const { user, container } = setup()
    const best = container.querySelector<HTMLElement>('.best-run')!
    expect(best.textContent).toContain('45–0')
    await user.click(best.querySelector('summary')!)
    expect(within(best).getAllByRole('listitem')).toHaveLength(6)
  })

  it('should skip Pokémon that no longer exist in the data', async () => {
    const odd = statsFrom(run(10, 'normal', [1, 999, 3, 4, 5, 6], '2026-09-01T10:00:00Z'))
    const { user, container } = setup(odd)
    const row = container.querySelector<HTMLElement>('.runs .run')!
    await user.click(row.querySelector('summary')!)
    expect(within(row).getAllByRole('listitem')).toHaveLength(5)
  })
})

describe('RecordsScreen run details', () => {
  it('should show the trainer for the rank earned beside each run title', () => {
    const { container } = setup()
    const rows = [...container.querySelectorAll('.runs .run')]
    expect(rows.map((r) => r.querySelector('summary .run__trainer')!.getAttribute('src'))).toEqual([
      '/trainers/pokemon-master.png',
      '/trainers/ace-trainer.png',
      '/trainers/champion.png',
    ])
  })

  it('should open the full analysis of a run from its expanded row', async () => {
    const { user, container, onViewRun } = setup()
    const row = container.querySelectorAll<HTMLElement>('.runs .run')[2]
    await user.click(row.querySelector('summary')!)
    await user.click(within(row).getByRole('button', { name: /full analysis/i }))
    expect(onViewRun).toHaveBeenCalledTimes(1)
    expect(onViewRun.mock.calls[0][0]).toMatchObject({ wins: 40, mode: 'normal' })
  })

  it('should offer the full analysis for the best run too', async () => {
    const { user, container, onViewRun } = setup()
    const best = container.querySelector<HTMLElement>('.best-run')!
    await user.click(best.querySelector('summary')!)
    await user.click(within(best).getByRole('button', { name: /full analysis/i }))
    expect(onViewRun.mock.calls[0][0]).toMatchObject({ wins: 45 })
  })

  it('should not offer the analysis when a Pokémon of the run no longer exists', async () => {
    const odd = statsFrom(run(10, 'normal', [1, 999, 3, 4, 5, 6], '2026-09-01T10:00:00Z'))
    const { user, container } = setup(odd)
    const row = container.querySelector<HTMLElement>('.runs .run')!
    await user.click(row.querySelector('summary')!)
    expect(within(row).queryByRole('button', { name: /full analysis/i })).toBeNull()
  })
})

describe('RecordsScreen navigation', () => {
  it('should call onBack from the back button', async () => {
    const { user, onBack } = setup()
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
