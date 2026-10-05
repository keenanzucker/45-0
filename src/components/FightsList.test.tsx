// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { GauntletFight } from '../data/types.ts'
import type { FightOutcome } from '../engine/simulate.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { FightsList } from './FightsList.tsx'

afterEach(cleanup)

const byId = new Map([1, 2, 3, 4].map((id) => [id, mkEntry(id, 1, ['fire'], { name: `Opp${id}` })]))

const fightOf = (id: string, gen: 1 | 2, name: string, team: number[]): GauntletFight => ({
  id,
  gen,
  region: gen === 1 ? 'Kanto' : 'Johto',
  name,
  tier: 'e4',
  game: 't',
  team,
})
const gauntlet = [
  fightOf('g1a', 1, 'Lorelei', [1, 2]),
  fightOf('g1b', 1, 'Bruno', [3]),
  fightOf('g2a', 2, 'Will', [4]),
]
const outcome = (fightId: string, won: boolean): FightOutcome => ({
  fightId,
  won,
  winProb: won ? 0.9 : 0.1,
  margin: won ? 1 : -1,
  trace: { targetBst: 600, opponents: [], mine: [], duels: [] },
})
const outcomes = [outcome('g1a', true), outcome('g1b', true), outcome('g2a', false)]

const setup = () => render(<FightsList gauntlet={gauntlet} outcomes={outcomes} byId={byId} />)

describe('FightsList', () => {
  it('should show one result square per generation above the fights', () => {
    const { container } = setup()
    const squares = [...container.querySelectorAll('.squares .sq')]
    expect(squares.map((s) => s.textContent)).toEqual(['G1', 'G2'])
    expect(squares[0].className).toContain('sq--g') // all won
    expect(squares[1].className).toContain('sq--r') // all lost
  })

  it('should list a collapsible entry per generation with its win count', () => {
    const { container } = setup()
    const gens = container.querySelectorAll('.gen')
    expect(gens).toHaveLength(2)
    expect(gens[0].querySelector('summary')!.textContent).toContain('Kanto')
    expect(gens[0].querySelector('summary')!.textContent).toContain('2/2')
    expect(gens[1].querySelector('summary')!.textContent).toContain('0/1')
  })

  it('should mark each fight won or lost and list the opposing team when opened', async () => {
    const user = userEvent.setup()
    const { container } = setup()
    const first = container.querySelectorAll<HTMLElement>('.gen')[0]
    await user.click(first.querySelector('summary')!)
    const rows = within(first).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('✔')
    expect(rows[0].textContent).toContain('Lorelei')
    expect(rows[0].textContent).toContain('Opp1, Opp2')
    expect(within(rows[0]).queryAllByRole('img')).toHaveLength(0)
    const second = container.querySelectorAll<HTMLElement>('.gen')[1]
    expect(within(second).getAllByRole('listitem')[0].textContent).toContain('✖')
  })

  it('should have a Fights heading', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Fights' })).toBeTruthy()
  })
})
