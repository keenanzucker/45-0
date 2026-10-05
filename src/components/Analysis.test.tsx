// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { DuelTrace, FightOutcome } from '../engine/simulate.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { Analysis } from './Analysis.tsx'

afterEach(cleanup)

const team = [
  mkEntry(1, 1, ['fire', 'flying'], { name: 'Blaze' }),
  mkEntry(2, 1, ['water'], { name: 'Brook' }),
  mkEntry(3, 1, ['ghost'], { name: 'Wisp' }),
]

const duel = (mine: number, over: Partial<DuelTrace>): DuelTrace => ({
  mine,
  opponent: 100,
  myEffectiveness: 1,
  opponentEffectiveness: 1,
  mySpeed: 100,
  opponentSpeed: 100,
  myRate: 0.1,
  opponentRate: 0.1,
  hpLostMine: 0,
  hpLostOpponent: 0,
  fainted: 'opponent',
  ...over,
})

const fights: FightOutcome[] = [
  {
    fightId: 'f',
    winProb: 0.5,
    margin: 1,
    won: true,
    trace: {
      targetBst: 600,
      opponents: [],
      mine: [],
      duels: [
        duel(1, { hpLostOpponent: 3, hpLostMine: 0.5 }),
        duel(2, { hpLostOpponent: 0.2, hpLostMine: 1.5, fainted: 'mine' }),
        duel(3, { hpLostOpponent: 1, hpLostMine: 0.2 }),
      ],
    },
  },
]

const HURT = 'Most of your losses came from Ground (57%) attackers.'

const setup = () => {
  const user = userEvent.setup()
  const utils = render(<Analysis team={team} fights={fights} hurt={HURT} />)
  return { user, ...utils }
}

describe('Analysis carry and weak link', () => {
  it('should name the carry and the weak link with their numbers', () => {
    const { container } = setup()
    const carry = container.querySelector('.mvp--carry')!
    expect(carry.textContent).toContain('Blaze')
    expect(carry.textContent).toMatch(/1 KO/)
    expect(carry.textContent).toMatch(/dealt 3\.0/i)
    const weak = container.querySelector('.mvp--weak')!
    expect(weak.textContent).toContain('Brook')
    expect(weak.textContent).toMatch(/fainted 1×/i)
    expect(weak.textContent).toMatch(/took 1\.5/i)
  })

  it('should omit the weak link when there is none', () => {
    const { container } = render(<Analysis team={[team[0]]} fights={fights} hurt={HURT} />)
    expect(container.querySelector('.mvp--carry')).not.toBeNull()
    expect(container.querySelector('.mvp--weak')).toBeNull()
  })
})

describe('Analysis headings', () => {
  it('should frame weak spots as defense and type coverage as offense', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Defense: weak spots' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Offense: type coverage' })).toBeTruthy()
  })
})

describe('Analysis order', () => {
  it('should not repeat the carry and weak link in a heading', () => {
    setup()
    expect(screen.queryByRole('heading', { name: /carry and weak link/i })).toBeNull()
  })

  it('should show the carry first, then the loss summary, then the weak spots', () => {
    const { container } = setup()
    const mvps = container.querySelector('.mvps')!
    const hurt = container.querySelector('.hurt')!
    const weak = screen.getByRole('table', { name: /weak spots/i })
    const coverage = screen.getByRole('table', { name: /type coverage/i })
    expect(hurt.textContent).toBe(HURT)
    const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(before(mvps, hurt)).toBe(true)
    expect(before(hurt, weak)).toBe(true)
    expect(before(weak, coverage)).toBe(true)
  })

  it('should explain the weak spots table', () => {
    setup()
    expect(screen.getByText(/damage each type deals to your pokémon/i)).toBeTruthy()
  })
})

describe('Analysis weak spots', () => {
  it('should show the five most exposed types by default with each member’s multiplier', () => {
    const { container } = setup()
    const table = screen.getByRole('table', { name: /weak spots/i })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)
    const rock = [...container.querySelectorAll('tbody tr')].find((r) => r.querySelector('.type--rock'))
    expect(rock?.textContent).toContain('×4')
  })

  it('should show all eighteen types when asked, and fold back', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /show all 18 weak spots/i }))
    const table = screen.getByRole('table', { name: /weak spots/i })
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(18)
    await user.click(screen.getByRole('button', { name: /show fewer weak spots/i }))
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(5)
  })

  it('should show only the sprite in each column header, since the types are on the team squares', () => {
    const { container } = setup()
    expect(container.querySelector('.defense .ttag')).toBeNull()
    const table = screen.getByRole('table', { name: /weak spots/i })
    const blaze = within(table).getByRole('columnheader', { name: 'Blaze' })
    expect(blaze.querySelector('img')!.getAttribute('width')).toBe('38')
  })

  it('should name each team member in the column headers', () => {
    setup()
    const table = screen.getByRole('table', { name: /weak spots/i })
    for (const name of ['Blaze', 'Brook', 'Wisp']) expect(within(table).getByRole('columnheader', { name })).toBeTruthy()
  })
})

describe('Analysis type coverage', () => {
  // Blaze fire/flying, Brook water, Wisp ghost: nothing hits water, rock or dragon super-effectively
  it('should list the uncovered types first, five by default', () => {
    setup()
    const table = screen.getByRole('table', { name: /type coverage/i })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)
    for (const row of rows) expect(row.textContent).not.toContain('×2')
  })

  it('should light the cell of each member that hits the type super-effectively and mark resisted hits', async () => {
    const { user, container } = setup()
    await user.click(screen.getByRole('button', { name: /show all 18 type coverage/i }))
    const table = screen.getByRole('table', { name: /type coverage/i })
    const grass = [...table.querySelectorAll('tbody tr')].find((r) => r.querySelector('.type--grass'))!
    const cells = [...grass.querySelectorAll('td')].map((c) => c.textContent)
    expect(cells).toEqual(['×2', '½', '']) // fire hits grass, water is resisted, ghost is neutral
    expect(container.querySelectorAll('.coverage .hit--2').length).toBeGreaterThan(0)
  })

  it('should say how many types are covered and name the missing ones', () => {
    setup()
    expect(screen.getByText(/you can hit 10 of 18 types super effectively\./i)).toBeTruthy()
    expect(screen.getByText(/missing: .*water/i)).toBeTruthy()
  })

  it('should explain what coverage means', () => {
    setup()
    expect(screen.getByText(/can hit super-effectively, or not, with its own types/i)).toBeTruthy()
  })

  it('should fold and unfold independently of the weak spots table', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /show all 18 type coverage/i }))
    expect(within(screen.getByRole('table', { name: /type coverage/i })).getAllByRole('row').slice(1)).toHaveLength(18)
    expect(within(screen.getByRole('table', { name: /weak spots/i })).getAllByRole('row').slice(1)).toHaveLength(5)
  })

  it('should say every type is covered when none are missing', () => {
    const all = [
      mkEntry(10, 1, ['fire', 'water'], { name: 'A' }),
      mkEntry(11, 1, ['fighting', 'ground'], { name: 'B' }),
      mkEntry(12, 1, ['ice', 'electric'], { name: 'C' }),
      mkEntry(13, 1, ['poison', 'psychic'], { name: 'D' }),
      mkEntry(14, 1, ['ghost', 'fairy'], { name: 'E' }),
      mkEntry(15, 1, ['rock', 'steel'], { name: 'F' }),
      mkEntry(16, 1, ['flying', 'dragon', 'grass', 'bug', 'dark', 'normal'], { name: 'G' }),
    ]
    render(<Analysis team={all} fights={[]} hurt={HURT} />)
    expect(screen.getByText(/you can hit all 18 types super effectively\./i)).toBeTruthy()
    expect(screen.queryByText(/missing:/i)).toBeNull()
  })
})
