// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameData } from '../data/load.ts'
import type { GauntletFight, PokemonEntry } from '../data/types.ts'
import { gridEntries, mkEntry } from '../engine/testUtils.ts'
import { encodeTeam } from '../results/share.ts'
import { Game } from './Game.tsx'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(k: string) { return this.data.get(k) ?? null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

const names = ['Aron', 'Bolt', 'Cleft', 'Drake', 'Ember', 'Fang', 'Gale', 'Hexa']
const entries: PokemonEntry[] = [
  ...gridEntries([1, 2], ['fire', 'water', 'grass'], 8).map((e, i) => ({
    ...e,
    name: `${names[i % 8]}${e.id}`,
    bst: 300 + i * 3,
    stats: { hp: 50 + (i % 5) * 10, atk: 60, def: 60, spa: 60, spd: 60, spe: 60 },
  })),
  mkEntry(1001, 1, ['fire'], { name: 'Zlegend', category: 'legend', legendKind: 'box-art', bst: 680 }),
  mkEntry(1002, 1, ['fire'], { name: 'Yrare', category: 'legend', legendKind: 'mythical', bst: 580 }),
]
const gauntlet: GauntletFight[] = Array.from({ length: 10 }, (_, i) => ({
  id: `g${(i % 2) + 1}-f${i}`,
  gen: ((i % 2) + 1) as 1 | 2,
  region: i % 2 ? 'Johto' : 'Kanto',
  name: `Boss${i}`,
  tier: 'e4' as const,
  game: 't',
  team: [1 + i, 20 + i, 30 + i],
}))
const data: GameData = { entries, gauntlet }

// The results screen logs every battle; keep that out of the test output.
beforeEach(() => {
  for (const method of ['log', 'groupCollapsed', 'groupEnd', 'table'] as const) {
    vi.spyOn(console, method).mockImplementation(() => {})
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const setup = (storage = new MemoryStorage(), extra: Partial<Parameters<typeof Game>[0]> = {}) => {
  const user = userEvent.setup()
  const utils = render(<Game data={data} storage={storage} makeSeed={() => 123} {...extra} />)
  return { user, storage, ...utils }
}

type User = ReturnType<typeof userEvent.setup>

const pullLever = (user: User) => user.click(screen.getByRole('button', { name: /pull the lever/i }))

const startNormal = async (user: User) => {
  await user.click(screen.getByRole('button', { name: /new game/i }))
  await pullLever(user)
}

/** Selects the first available Pokémon, places it, then pulls the lever for the next spin if the game continues. */
const pickAndPlace = async (user: User, container: HTMLElement) => {
  const row = container.querySelector<HTMLButtonElement>('.pick:not(:disabled)')!
  await user.click(row)
  await user.click(screen.getAllByRole('button', { name: /tap to place/i })[0])
  const lever = screen.queryByRole('button', { name: /pull the lever/i }) as HTMLButtonElement | null
  if (lever && !lever.disabled) await user.click(lever)
}

const playAll = async (user: ReturnType<typeof userEvent.setup>, container: HTMLElement) => {
  for (let i = 0; i < 6; i++) await pickAndPlace(user, container)
}

describe('start screen', () => {
  it('should offer both modes and show the fan-project disclaimer', () => {
    setup()
    expect(screen.getByRole('button', { name: /new game/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /hard mode/i })).toBeTruthy()
    expect(screen.getByText(/unofficial fan project/i)).toBeTruthy()
  })

  it('should decorate the top screen with falling sprites behind the 45-0 logo', () => {
    const { container } = setup()
    const top = container.querySelector('.ds__screen--top')!
    expect(screen.getByRole('heading', { name: '45-0' })).toBeTruthy()
    expect(top.querySelectorAll('.fall img').length).toBeGreaterThan(0)
    expect(top.querySelector('.fall')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('should credit every data source in the footer with a link', () => {
    const { container } = setup()
    const links = [...container.querySelectorAll<HTMLAnchorElement>('.fine a')]
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['PokéAPI', 'https://pokeapi.co'],
      ['PokémonDB', 'https://pokemondb.net'],
      ['DittoBase', 'https://www.dittobase.com'],
    ])
    for (const a of links) expect(a.getAttribute('rel')).toContain('noreferrer')
  })

  it('should explain the game under the logo in one line', () => {
    const { container } = setup()
    expect(container.querySelector('.hero__tag')!.textContent).toBe(
      'Build an elite team of six to take on the 45-trainer gauntlet.',
    )
  })

  it('should list a few tips under How to play, collapsed until opened', async () => {
    const { user, container } = setup()
    const tips = container.querySelector<HTMLDetailsElement>('details.tips')!
    expect(tips.querySelector('summary')!.textContent).toBe('Tips')
    expect(tips.open).toBe(false)
    expect(tips.querySelectorAll('li').length).toBeGreaterThanOrEqual(3)
    expect(tips.querySelectorAll('li').length).toBeLessThanOrEqual(5)
    const order = [...container.querySelectorAll('details')].map((d) => d.querySelector('summary')!.textContent)
    expect(order).toEqual(['How to play', 'Tips'])
    await user.click(tips.querySelector('summary')!)
    expect(tips.open).toBe(true)
  })

  it('should open the records view from My records and return with Back', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /my records/i }))
    expect(screen.getByRole('heading', { name: /my records/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /new game/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('button', { name: /new game/i })).toBeTruthy()
  })

  it('should show a run finished in this session in the records view', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    await user.click(screen.getByRole('button', { name: /play again/i }))
    await user.click(screen.getByRole('button', { name: /my records/i }))
    expect(container.querySelectorAll('.runs .run')).toHaveLength(1)
  })

  it('should open the full analysis of a past run and return to the records with Back', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    const record = screen.getByLabelText(/record \d+ wins, \d+ losses/i).getAttribute('aria-label')
    await user.click(screen.getByRole('button', { name: /play again/i }))
    await user.click(screen.getByRole('button', { name: /my records/i }))
    const row = container.querySelector<HTMLElement>('.runs .run')!
    await user.click(row.querySelector('summary')!)
    await user.click(within(row).getByRole('button', { name: /full analysis/i }))
    expect(screen.getByLabelText(/record \d+ wins, \d+ losses/i).getAttribute('aria-label')).toBe(record)
    expect(screen.getByRole('heading', { name: 'Analysis' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /play again|play your own/i })).toBeNull()
    expect(screen.queryByText(/shared team/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('heading', { name: /my records/i })).toBeTruthy()
    expect(container.querySelectorAll('.runs .run')).toHaveLength(1)
  })
})

describe('normal mode draft', () => {
  it('should show the spin, stats, sort chips and an empty team', async () => {
    const { user, container } = setup()
    await startNormal(user)
    expect(screen.getByText(/pick 1 of 6/i)).toBeTruthy()
    expect(screen.getByRole('img', { name: /^era:/i })).toBeTruthy()
    expect(screen.getByRole('img', { name: /^type:/i })).toBeTruthy()
    expect(screen.getByRole('group', { name: /sort by/i })).toBeTruthy()
    expect(container.querySelectorAll('.pick').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.pick__bst')).not.toBeNull()
    expect(container.querySelector('.bars')).not.toBeNull()
  })

  it('should list entries by BST descending by default', async () => {
    const { user, container } = setup()
    await user.click(screen.getByRole('button', { name: /new game/i }))
    const bsts = [...container.querySelectorAll('.pick:not(:disabled) .pick__bst')].map((n) => Number(n.textContent))
    expect(bsts).toEqual([...bsts].sort((a, b) => b - a))
  })

  it('should select a Pokémon, highlight eligible slots, and place it on tap', async () => {
    const { user, container } = setup()
    await startNormal(user)
    expect(screen.queryAllByRole('button', { name: /tap to place/i })).toHaveLength(0)
    await user.click(container.querySelector<HTMLButtonElement>('.pick:not(:disabled)')!)
    expect(screen.getAllByRole('button', { name: /tap to place/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('status').textContent).toMatch(/tap a glowing slot/i)
    await user.click(screen.getAllByRole('button', { name: /tap to place/i })[0])
    expect(screen.getByText(/pick 2 of 6/i)).toBeTruthy()
    expect(within(screen.getByRole('list', { name: /your team/i })).getAllByRole('button', { name: /slot: /i })).toHaveLength(1)
  })

  it('should clear the selection when Cancel is pressed', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await user.click(container.querySelector<HTMLButtonElement>('.pick:not(:disabled)')!)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryAllByRole('button', { name: /tap to place/i })).toHaveLength(0)
  })

  it('should reroll the era once, keep the type, and disable the button', async () => {
    const { user } = setup()
    await startNormal(user)
    const typeBefore = screen.getByRole('img', { name: /^type:/i }).getAttribute('aria-label')
    const reroll = screen.getByRole('button', { name: /reroll era/i }) as HTMLButtonElement
    await user.click(reroll)
    expect(screen.getByRole('img', { name: /^type:/i }).getAttribute('aria-label')).toBe(typeBefore)
    expect((screen.getByRole('button', { name: /reroll era/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('should finish after six picks and show the record, title, team and share button', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    expect(screen.getByLabelText(/record \d+ wins, \d+ losses/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /share/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /play again/i })).toBeTruthy()
    expect(container.querySelectorAll('.hof__mon')).toHaveLength(6)
    expect(container.querySelectorAll('.gen')).toHaveLength(2)
  })

  it('should put the team around the record on the top screen, with no tabs below', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    expect(screen.queryByRole('tab')).toBeNull()
    const top = container.querySelector('.ds__screen--top')!
    const mons = top.querySelectorAll('.hof__mon')
    expect(mons).toHaveLength(6)
    expect(top.querySelector('.result__record')).not.toBeNull()
    for (const m of mons) {
      expect(m.querySelector('.sprite')).not.toBeNull()
      expect(m.querySelector('.hof__name')!.textContent).not.toBe('')
      expect(m.querySelector('.hof__bst')!.textContent).toMatch(/^BST \d+$/)
    }
  })

  it('should show the trainer for the earned title beside the record on the top screen', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    const top = container.querySelector('.ds__screen--top')!
    const trainer = top.querySelector('.result__rank .result__trainer')!
    expect(trainer.getAttribute('src')).toMatch(/^\/trainers\/[a-z-]+\.png$/)
    expect(top.querySelector('.result__rank')!.contains(top.querySelector('.result__record'))).toBe(true)
  })

  it('should stack each team member as name, sprite, BST, then type tags', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    for (const m of container.querySelectorAll('.hof__mon')) {
      const order = [...m.children].map((c) => c.className.split(' ')[0])
      expect(order).toEqual(['hof__name', 'sprite', 'hof__bst', 'ttags'])
      expect(m.querySelectorAll('.ttags .ttag').length).toBeGreaterThanOrEqual(1)
    }
  })

  it('should start the bottom screen with a centered Analysis heading', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    const heading = screen.getByRole('heading', { name: 'Analysis' })
    expect(heading.className).toContain('h2--center')
    expect(container.querySelector('.result-scroll')!.firstElementChild).toBe(heading)
  })

  it('should stagger the team pop-in with a per-square delay index', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    const idx = [...container.querySelectorAll<HTMLElement>('.hof__mon')].map((m) => m.style.getPropertyValue('--i'))
    expect(idx).toEqual(['0', '1', '2', '3', '4', '5'])
  })

  it('should show the analysis, then the fights, in one scroll with Share and Play again pinned', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    const bottom = container.querySelector('.ds__screen--bottom')!
    expect(bottom.querySelector('.hurt')).not.toBeNull()
    expect(screen.getByRole('table', { name: /weak spots/i })).toBeTruthy()
    expect(bottom.querySelector('.mvp--carry')).not.toBeNull()
    expect(bottom.querySelectorAll('.gen')).toHaveLength(2)
    expect(bottom.querySelector('.squares')).not.toBeNull()
    expect(container.querySelector('.ds__screen--top .squares')).toBeNull()
    const scroll = bottom.querySelector('.result-scroll')!
    expect(scroll.contains(screen.getByRole('button', { name: /share/i }))).toBe(false)
    expect(screen.getByRole('button', { name: /play again/i })).toBeTruthy()
    const analysis = bottom.querySelector('.analysis')!
    const fights = bottom.querySelector('.gen')!
    expect(Boolean(analysis.compareDocumentPosition(fights) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('should log one console group per fight when the results show with ?debug in the URL', async () => {
    window.history.pushState({}, '', '/?debug')
    try {
      const groups = vi.spyOn(console, 'groupCollapsed')
      const { user, container } = setup()
      await startNormal(user)
      await playAll(user, container)
      expect(groups).toHaveBeenCalledTimes(gauntlet.length)
      expect(String(groups.mock.calls[0][0])).toMatch(/WON|LOST/)
    } finally {
      window.history.pushState({}, '', '/')
    }
  })

  it('should keep the console quiet when the results show without ?debug', async () => {
    const groups = vi.spyOn(console, 'groupCollapsed')
    const log = vi.spyOn(console, 'log')
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    expect(groups).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('should return to the start screen on Play again and count the finished game', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await playAll(user, container)
    await user.click(screen.getByRole('button', { name: /play again/i }))
    expect(screen.getByRole('button', { name: /new game/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /my records/i }))
    expect(screen.getByText('Runs', { selector: 'dt' }).nextElementSibling!.textContent).toBe('1')
  })
})

describe('lever', () => {
  it('should start a new game waiting for the lever: blank reels, no list, rerolls off', async () => {
    const { user, container } = setup()
    await user.click(screen.getByRole('button', { name: /new game/i }))
    const lever = screen.getByRole('button', { name: /pull the lever/i }) as HTMLButtonElement
    expect(lever.disabled).toBe(false)
    expect(screen.getByRole('img', { name: /era: waiting/i })).toBeTruthy()
    expect(screen.getByRole('img', { name: /type: waiting/i })).toBeTruthy()
    expect(container.querySelectorAll('.pick')).toHaveLength(0)
    expect((screen.getByRole('button', { name: /reroll era/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /reroll type/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('should reveal the spin and the pick list when pulled, and lock the lever', async () => {
    const { user, container } = setup()
    await startNormal(user)
    expect(screen.getByRole('img', { name: /^era: generation/i })).toBeTruthy()
    expect(container.querySelectorAll('.pick').length).toBeGreaterThan(0)
    expect((screen.getByRole('button', { name: /pull the lever/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('should not deal the next spin after a placement until the lever is pulled again', async () => {
    const { user, container } = setup()
    await startNormal(user)
    await user.click(container.querySelector<HTMLButtonElement>('.pick:not(:disabled)')!)
    await user.click(screen.getAllByRole('button', { name: /tap to place/i })[0])
    expect(screen.getByText(/pick 2 of 6/i)).toBeTruthy()
    expect(container.querySelectorAll('.pick')).toHaveLength(0)
    expect(screen.getByRole('img', { name: /era: waiting/i })).toBeTruthy()
    expect((screen.getByRole('button', { name: /pull the lever/i }) as HTMLButtonElement).disabled).toBe(false)
    await pullLever(user)
    expect(container.querySelectorAll('.pick').length).toBeGreaterThan(0)
  })

  it('should keep waiting for the lever after a reload instead of spinning on its own', async () => {
    const storage = new MemoryStorage()
    const first = setup(storage)
    await startNormal(first.user)
    await pickAndPlace(first.user, first.container) // places, then pulls for pick 2
    await first.user.click(first.container.querySelector<HTMLButtonElement>('.pick:not(:disabled)')!)
    await first.user.click(screen.getAllByRole('button', { name: /tap to place/i })[0]) // pick 2 placed, lever waiting
    cleanup()
    const second = setup(storage)
    expect(screen.getByText(/pick 3 of 6/i)).toBeTruthy()
    expect(second.container.querySelectorAll('.pick')).toHaveLength(0)
    expect((screen.getByRole('button', { name: /pull the lever/i }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('hard mode draft', () => {
  const startHard = async () => {
    const ctx = setup()
    await ctx.user.click(screen.getByRole('button', { name: /hard mode/i }))
    await pullLever(ctx.user)
    return ctx
  }

  it('should hide stats, types and sort chips but keep the category filter', async () => {
    const { container } = await startHard()
    expect(screen.getByText(/hard mode/i)).toBeTruthy()
    expect(container.querySelector('.pick__bst')).toBeNull()
    expect(container.querySelector('.bars')).toBeNull()
    expect(container.querySelector('.pick .type')).toBeNull()
    expect(screen.queryByRole('group', { name: /sort by/i })).toBeNull()
    expect(screen.getByRole('group', { name: /filter by slot type/i })).toBeTruthy()
  })

  it('should list Pokémon alphabetically', async () => {
    const { container } = await startHard()
    const shown = [...container.querySelectorAll('.pick:not(:disabled) .pick__name')].map((n) => n.textContent!)
    expect(shown).toEqual([...shown].sort((a, b) => a.localeCompare(b)))
  })

  it('should show only sprites and names on the team board until the results', async () => {
    const { user, container } = await startHard()
    await pickAndPlace(user, container)
    expect(container.querySelector('.board .type')).toBeNull()
    await playAllRemaining(user, container, 5)
    expect(container.querySelector('.hof__mon .ttag')).not.toBeNull()
    expect(screen.getAllByText(/hard mode/i).length).toBeGreaterThan(0)
  })
})

const playAllRemaining = async (user: ReturnType<typeof userEvent.setup>, container: HTMLElement, n: number) => {
  for (let i = 0; i < n; i++) await pickAndPlace(user, container)
}

describe('quit and resume', () => {
  it('should ask for confirmation before quitting a run', async () => {
    const { user } = setup()
    await startNormal(user)
    await user.click(screen.getByRole('button', { name: /quit/i }))
    expect(screen.getByText(/quit run\?/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^no$/i }))
    expect(screen.getByText(/pick 1 of 6/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /quit/i }))
    await user.click(screen.getByRole('button', { name: /^yes$/i }))
    expect(screen.getByRole('button', { name: /new game/i })).toBeTruthy()
  })

  it('should resume an in-progress run after a reload', async () => {
    const storage = new MemoryStorage()
    const first = setup(storage)
    await startNormal(first.user)
    await pickAndPlace(first.user, first.container)
    cleanup()
    setup(storage)
    expect(screen.getByText(/pick 2 of 6/i)).toBeTruthy()
  })
})

describe('shared team link', () => {
  const code = encodeTeam('hard', [1, 9, 17, 25, 33, 41])

  it('should show the shared team and record with a challenge instead of the analysis', () => {
    const { container } = setup(new MemoryStorage(), { sharedCode: code })
    expect(container.querySelectorAll('.ds__screen--top .hof__mon')).toHaveLength(6)
    expect(screen.getByLabelText(/record \d+ wins, \d+ losses/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^can you beat \d+–\d+\?$/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Analysis' })).toBeNull()
    expect(container.querySelector('.fights')).toBeNull()
    expect(screen.queryByText(/shared team/i)).toBeNull()
  })

  it('should keep the hard mode badge on a shared hard mode team', () => {
    setup(new MemoryStorage(), { sharedCode: code })
    expect(screen.getByText(/hard mode/i)).toBeTruthy()
  })

  it('should explain the game and offer to build your own team', async () => {
    const { user } = setup(new MemoryStorage(), { sharedCode: code })
    expect(screen.getByText(/build an elite team of six/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /build your own team/i }))
    expect(screen.getByRole('button', { name: /new game/i })).toBeTruthy()
  })

  it('should put the build button right under the pitch and offer no breakdown', () => {
    const { container } = setup(new MemoryStorage(), { sharedCode: code })
    const challenge = container.querySelector('.challenge')!
    expect(challenge.querySelector('h2')).not.toBeNull()
    expect(challenge.querySelector('.challenge__blurb')).not.toBeNull()
    expect(challenge.querySelector('button')!.textContent).toBe('BUILD YOUR OWN TEAM')
    expect(container.querySelector('details')).toBeNull()
    expect(screen.queryByText(/full breakdown/i)).toBeNull()
  })

  it('should ignore a malformed or unknown share code', () => {
    setup(new MemoryStorage(), { sharedCode: 'garbage' })
    expect(screen.getByRole('button', { name: /new game/i })).toBeTruthy()
    cleanup()
    setup(new MemoryStorage(), { sharedCode: encodeTeam('normal', [1, 2, 3, 4, 5, 999999]) })
    expect(screen.getByRole('button', { name: /new game/i })).toBeTruthy()
  })
})
