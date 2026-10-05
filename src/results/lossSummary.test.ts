import { describe, expect, it } from 'vitest'
import type { PokemonEntry, PokemonType } from '../data/types.ts'
import type { Combatant, RateAdjust } from '../engine/battle.ts'
import { createSimulator, type FightOutcome, type LossDriver, type SimulationResult } from '../engine/simulate.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { explainLosses } from './lossSummary.ts'

const mon = (id: number, types: PokemonType[], name = `M${id}`) => mkEntry(id, 1, types, { name })

// Fire attackers hit Grass, Ice, Bug and Steel; they cannot hit Water, Dragon or Rock super-effectively.
const team = [mon(1, ['fire']), mon(2, ['fire'])]
const opponents = [mon(100, ['water']), mon(101, ['dragon']), mon(102, ['grass'])]
const byId: ReadonlyMap<number, PokemonEntry> = new Map([...team, ...opponents].map((e) => [e.id, e]))

const outcome = (fightId: string, won: boolean, standing: number[] = []): FightOutcome => ({
  fightId,
  won,
  winProb: won ? 0.9 : 0.1,
  margin: won ? 1 : -1,
  trace: {
    targetBst: 600,
    mine: [],
    duels: [],
    opponents: standing.map((id) => ({ id, hpLeft: 0.5, scaledBst: 600 })),
  },
})

const resultOf = (fights: FightOutcome[], lossDrivers: LossDriver[] = []): SimulationResult => {
  const wins = fights.filter((f) => f.won).length
  return { wins, losses: fights.length - wins, fights, lossDrivers }
}

interface Replays {
  defense?: boolean[]
  offense?: boolean[]
}

const fakeSim = (replays: Replays, seen: RateAdjust[] = []) => ({
  fightsWon(_ids: readonly number[], adjust?: RateAdjust) {
    seen.push(adjust ?? {})
    if (adjust?.theirs) return replays.defense ?? []
    if (adjust?.mine) return replays.offense ?? []
    return []
  },
})

const drivers: LossDriver[] = [
  { type: 'psychic', share: 0.23 },
  { type: 'water', share: 0.18 },
]

describe('explainLosses', () => {
  it('should say a flawless run was flawless', () => {
    const r = resultOf([outcome('a', true), outcome('b', true)])
    expect(explainLosses({ team, result: r, sim: fakeSim({}), byId })).toBe('Flawless. Nothing got through.')
  })

  it('should name the offense problem when covering the gaps would save more fights than fixing defense', () => {
    const r = resultOf([outcome('a', false, [100]), outcome('b', false, [100, 101]), outcome('c', false, [102]), outcome('d', true)], drivers)
    const sim = fakeSim({ defense: [true, false, false, true], offense: [true, true, true, true] })
    expect(explainLosses({ team, result: r, sim, byId })).toBe(
      "In 2 of 3 losses, the opponent left standing was a type your team can't hit super-effectively (Water, Dragon).",
    )
  })

  it('should keep the original attacker line when fixing defense would save at least as many fights', () => {
    const r = resultOf([outcome('a', false, [100]), outcome('b', false, [101]), outcome('c', true)], drivers)
    const sim = fakeSim({ defense: [true, true, true], offense: [true, false, true] })
    expect(explainLosses({ team, result: r, sim, byId })).toBe(
      'Most of your losses came from Psychic (23%), Water (18%) attackers.',
    )
  })

  it('should prefer the attacker line on a tie', () => {
    const r = resultOf([outcome('a', false, [100]), outcome('b', true)], drivers)
    const sim = fakeSim({ defense: [true, true], offense: [true, true] })
    expect(explainLosses({ team, result: r, sim, byId })).toMatch(/^Most of your losses came from/)
  })

  it('should say the team was outclassed when neither fix helps and nothing super-effective hurt', () => {
    const r = resultOf([outcome('a', false, [100])], [])
    const sim = fakeSim({ defense: [false], offense: [false] })
    expect(explainLosses({ team, result: r, sim, byId })).toBe('Your team was simply outclassed.')
  })

  it('should count a single loss in the singular', () => {
    const r = resultOf([outcome('a', false, [100]), outcome('b', true)], drivers)
    const sim = fakeSim({ defense: [false, true], offense: [true, true] })
    expect(explainLosses({ team, result: r, sim, byId })).toBe(
      "In 1 of 1 loss, the opponent left standing was a type your team can't hit super-effectively (Water).",
    )
  })

  it('should list the gap types in order of how often they ended a loss', () => {
    const r = resultOf([outcome('a', false, [101]), outcome('b', false, [100]), outcome('c', false, [101])], drivers)
    const sim = fakeSim({ defense: [false, false, false], offense: [true, true, true] })
    expect(explainLosses({ team, result: r, sim, byId })).toContain('(Dragon, Water)')
  })

  it('should skip the offense replay when the team has no coverage gaps', () => {
    const all = [
      mon(10, ['fire', 'water']),
      mon(11, ['fighting', 'ground']),
      mon(12, ['ice', 'electric']),
      mon(13, ['poison', 'psychic']),
      mon(14, ['ghost', 'fairy']),
      mon(15, ['rock', 'steel']),
      mon(16, ['flying', 'dragon', 'grass', 'bug', 'dark', 'normal']),
    ]
    const seen: RateAdjust[] = []
    const r = resultOf([outcome('a', false, [100])], drivers)
    const text = explainLosses({ team: all, result: r, sim: fakeSim({ defense: [false] }, seen), byId })
    expect(seen.some((a) => a.mine)).toBe(false)
    expect(text).toMatch(/^Most of your losses came from/)
  })

  describe('what-if replays', () => {
    const seen: RateAdjust[] = []
    const r = resultOf([outcome('a', false, [100])], drivers)
    explainLosses({ team, result: r, sim: fakeSim({ defense: [false], offense: [false] }, seen), byId })
    const mine = seen.find((a) => a.mine)!.mine!
    const theirs = seen.find((a) => a.theirs)!.theirs!
    const target = (types: PokemonType[]): Combatant => ({ types, stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } })

    it('should lift my attacks to super-effective only against defenders with a gap type', () => {
      expect(mine(1, target(['water']))).toBe(2)
      expect(mine(0.5, target(['water', 'grass']))).toBe(2)
      expect(mine(1, target(['grass']))).toBe(1)
      expect(mine(2, target(['water']))).toBe(2)
      expect(mine(4, target(['water']))).toBe(4)
    })

    it('should cap their attacks at neutral', () => {
      expect(theirs(4, target(['fire']))).toBe(1)
      expect(theirs(2, target(['fire']))).toBe(1)
      expect(theirs(0.5, target(['fire']))).toBe(0.5)
      expect(theirs(0, target(['fire']))).toBe(0)
    })
  })

  it('should agree with a real simulation: a Normal team that cannot dent Steel is told it lacks coverage', () => {
    const flat = (v: number) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v })
    const normals = [1, 2, 3, 4, 5, 6].map((id) => ({ ...mon(id, ['normal']), stats: flat(100), bst: 600 }))
    const steels = [100, 101, 102, 103, 104, 105].map((id) => ({ ...mon(id, ['steel']), stats: flat(100), bst: 600 }))
    const lookup = new Map([...normals, ...steels].map((e) => [e.id, e]))
    const sim = createSimulator(lookup, [
      { id: 'f', gen: 1, region: 'T', name: 'f', tier: 'e4', game: 't', team: [100, 101, 102, 103, 104, 105] },
    ])
    const result = sim.simulate([1, 2, 3, 4, 5, 6])
    expect(result.losses).toBe(1)
    expect(explainLosses({ team: normals, result, sim, byId: lookup })).toMatch(/^In 1 of 1 loss, .*\(Steel\)\.$/)
  })
})
