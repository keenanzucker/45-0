import { describe, expect, it, vi } from 'vitest'
import type { FightTier, GauntletFight, PokemonEntry, PokemonType } from '../data/types.ts'
import { DEFAULT_PARAMS } from '../engine/battle.ts'
import { createSimulator } from '../engine/simulate.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { describeFight, isDebugLogging, logBattles } from './battleLog.ts'

const flat = (v: number) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v })
const mon = (id: number, name: string, types: PokemonType[], v: number): PokemonEntry => ({
  ...mkEntry(id, 1, types, { stats: flat(v), bst: 6 * v }),
  name,
})
const fight = (id: string, team: number[], tier: FightTier = 'e4'): GauntletFight => ({
  id,
  gen: 2,
  region: 'Johto',
  name: `Trainer ${id}`,
  tier,
  game: 'test',
  team,
})

const opp = [mon(100, 'Charmander', ['fire'], 100), mon(101, 'Rattata', ['normal'], 100)]
const strong = [mon(1, 'Squirtle', ['water'], 300), mon(2, 'Bulbasaur', ['grass'], 300)]
const feeble = [mon(3, 'Magikarp', ['water'], 20), mon(4, 'Caterpie', ['bug'], 20)]
const byId = new Map([...opp, ...strong, ...feeble].map((e) => [e.id, e]))
const gauntlet = [fight('win', [100, 101]), fight('loss', [100, 101], 'champion')]
const sim = createSimulator(byId, gauntlet, DEFAULT_PARAMS)

const outcome = (team: number[], i: number) => sim.simulate(team).fights[i]

describe('describeFight', () => {
  it('should headline a won fight with the trainer, margin and win probability', () => {
    const { title } = describeFight(gauntlet[0], outcome([1, 2], 0), byId)
    expect(title).toContain('WON')
    expect(title).toContain('G2 Johto')
    expect(title).toContain('Trainer win')
    expect(title).toMatch(/margin \+\d/)
    expect(title).toMatch(/win prob \d+%/)
  })

  it('should headline a lost fight with a negative margin', () => {
    const { title } = describeFight(gauntlet[1], outcome([3, 4], 1), byId)
    expect(title).toContain('LOST')
    expect(title).toContain('champion')
    expect(title).toMatch(/margin -\d/)
  })

  it('should explain a win by the Pokémon still standing', () => {
    const { lines } = describeFight(gauntlet[0], outcome([1, 2], 0), byId)
    const text = lines.join('\n')
    expect(text).toMatch(/all opponents fainted/i)
    expect(text).toMatch(/Squirtle|Bulbasaur/)
  })

  it('should explain a loss by the opponents still standing', () => {
    const { lines } = describeFight(gauntlet[1], outcome([3, 4], 1), byId)
    const text = lines.join('\n')
    expect(text).toMatch(/all your Pokémon fainted/i)
    expect(text).toMatch(/Charmander|Rattata/)
  })

  it('should list every duel with the names, type effectiveness and who fainted', () => {
    const o = outcome([1, 2], 0)
    const { lines } = describeFight(gauntlet[0], o, byId)
    const duelLines = lines.filter((l) => l.includes(' vs '))
    expect(duelLines).toHaveLength(o.trace.duels.length)
    expect(duelLines[0]).toContain('Squirtle vs Charmander')
    expect(duelLines[0]).toContain('x2')
    expect(duelLines[0]).toMatch(/Charmander fainted/)
  })

  it('should state the rule that decides the fight', () => {
    const { lines } = describeFight(gauntlet[0], outcome([1, 2], 0), byId)
    expect(lines.join('\n')).toMatch(/margin > 0/)
  })
})

describe('logBattles', () => {
  const makeLog = () => ({
    groupCollapsed: vi.fn(),
    groupEnd: vi.fn(),
    log: vi.fn(),
    table: vi.fn(),
  })

  it('should open one collapsed group per fight and close each', () => {
    const log = makeLog()
    logBattles(sim.simulate([1, 2]), gauntlet, byId, log)
    expect(log.groupCollapsed).toHaveBeenCalledTimes(gauntlet.length)
    expect(log.groupEnd).toHaveBeenCalledTimes(gauntlet.length)
  })

  it('should print a summary table with one row per fight', () => {
    const log = makeLog()
    logBattles(sim.simulate([1, 2]), gauntlet, byId, log)
    expect(log.table).toHaveBeenCalledTimes(1)
    const rows = log.table.mock.calls[0][0] as unknown[]
    expect(rows).toHaveLength(gauntlet.length)
  })

  it('should print the record', () => {
    const log = makeLog()
    const result = sim.simulate([1, 2])
    logBattles(result, gauntlet, byId, log)
    const printed = log.log.mock.calls.flat().join('\n')
    expect(printed).toContain(`${result.wins}-${result.losses}`)
  })
})

describe('isDebugLogging', () => {
  it.each(['?debug', '?debug=1', '?t=n.1.2.3.4.5.6&debug', '?debug&t=n.1.2.3.4.5.6'])(
    'should turn the battle log on for %j',
    (search) => {
      expect(isDebugLogging(search)).toBe(true)
    },
  )

  it.each(['', '?', '?t=n.1.2.3.4.5.6', '?debugging', '?nodebug=1', '?x=debug'])(
    'should keep the battle log off for %j',
    (search) => {
      expect(isDebugLogging(search)).toBe(false)
    },
  )
})
