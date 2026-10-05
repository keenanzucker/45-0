import { describe, expect, it } from 'vitest'
import type { FightTier, GauntletFight, PokemonEntry, PokemonType } from '../data/types.ts'
import { DEFAULT_PARAMS, type SimParams } from './battle.ts'
import { createSimulator } from './simulate.ts'
import { mkEntry } from './testUtils.ts'

const params: SimParams = { ...DEFAULT_PARAMS, oppTargetBst: 600, championBonus: 0.1 }

const flat = (v: number) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v })

const mon = (id: number, types: PokemonType[], v: number): PokemonEntry =>
  mkEntry(id, 1, types, { stats: flat(v), bst: 6 * v })

const fight = (id: string, team: number[], tier: FightTier = 'e4'): GauntletFight => ({
  id,
  gen: 1,
  region: 'Test',
  name: id,
  tier,
  game: 'test',
  team,
})

const byId = (...entries: PokemonEntry[]) => new Map(entries.map((e) => [e.id, e]))

describe('createSimulator', () => {
  const weakOpp = [mon(100, ['normal'], 100), mon(101, ['normal'], 100)]
  const gauntlet = [fight('a', [100, 101]), fight('b', [101, 100]), fight('c', [100])]
  const strong = Array.from({ length: 6 }, (_, i) => mon(i + 1, ['normal'], 200))
  const feeble = Array.from({ length: 6 }, (_, i) => mon(i + 11, ['normal'], 20))
  const lookup = byId(...weakOpp, ...strong, ...feeble)
  const sim = createSimulator(lookup, gauntlet, params)

  it('should win every fight with a much stronger team and lose every fight with a much weaker one', () => {
    expect(sim.simulate(strong.map((e) => e.id))).toMatchObject({ wins: 3, losses: 0 })
    expect(sim.simulate(feeble.map((e) => e.id))).toMatchObject({ wins: 0, losses: 3 })
  })

  it('should report one outcome per fight with a win flag consistent with margin and winProb', () => {
    const r = sim.simulate(strong.map((e) => e.id))
    expect(r.fights.map((f) => f.fightId)).toEqual(['a', 'b', 'c'])
    for (const f of r.fights) {
      expect(f.won).toBe(f.margin > 0)
      expect(f.won).toBe(f.winProb >= 0.5)
      expect(f.winProb).toBeGreaterThan(0)
      expect(f.winProb).toBeLessThan(1)
    }
    expect(r.wins + r.losses).toBe(gauntlet.length)
  })

  it('should be deterministic', () => {
    const ids = strong.map((e) => e.id)
    expect(sim.simulate(ids)).toEqual(sim.simulate(ids))
  })

  it('should accept teams smaller than six and agree with wins()', () => {
    const ids = [1, 2, 3]
    expect(sim.wins(ids)).toBe(sim.simulate(ids).wins)
  })

  it('should expose a smooth expected-wins value equal to the sum of win probabilities', () => {
    const ids = strong.map((e) => e.id)
    const sum = sim.simulate(ids).fights.reduce((acc, f) => acc + f.winProb, 0)
    expect(sim.value(ids)).toBeCloseTo(sum, 12)
    expect(sim.value(ids)).toBeGreaterThan(sim.value(feeble.map((e) => e.id)))
  })

  it('should reject empty teams and unknown ids', () => {
    expect(() => sim.simulate([])).toThrow(/team/)
    expect(() => sim.simulate([9999])).toThrow(/9999/)
  })

  it('should reject a gauntlet that references an unknown Pokémon', () => {
    expect(() => createSimulator(lookup, [fight('x', [424242])], params)).toThrow(/424242/)
  })
})

describe('opponent normalization', () => {
  const mine = [mon(1, ['normal'], 100), mon(2, ['normal'], 100)]

  it('should make results independent of the raw stat magnitude of opponents', () => {
    const run = (v: number) => {
      const opp = [mon(100, ['normal'], v), mon(101, ['fire'], v * 1.5)]
      const sim = createSimulator(byId(...mine, ...opp), [fight('f', [100, 101])], params)
      return sim.simulate([1, 2]).fights[0].margin
    }
    expect(run(50)).toBeCloseTo(run(150), 9)
  })

  it('should keep relative strength inside an opponent team', () => {
    const opp = [mon(100, ['normal'], 40), mon(101, ['normal'], 200)]
    const sim = createSimulator(byId(...mine, ...opp), [fight('f', [100, 101])], params)
    expect(sim.simulate([1, 2]).fights).toHaveLength(1)
  })

  it('should make champion fights harder than the same team as an Elite Four fight', () => {
    const opp = [mon(100, ['normal'], 100), mon(101, ['normal'], 100)]
    const sim = createSimulator(
      byId(...mine, ...opp),
      [fight('e4', [100, 101], 'e4'), fight('champ', [100, 101], 'champion')],
      params,
    )
    const [e4, champ] = sim.simulate([1, 2]).fights
    expect(champ.margin).toBeLessThan(e4.margin)
  })
})

describe('team size adjustment', () => {
  const mine = [mon(1, ['normal'], 100), mon(2, ['normal'], 100), mon(3, ['normal'], 100)]
  const opp = Array.from({ length: 6 }, (_, i) => mon(100 + i, ['normal'], 100))
  const margin = (size: number, teamSizeBonus: number) => {
    const sim = createSimulator(
      byId(...mine, ...opp),
      [fight('f', opp.slice(0, size).map((e) => e.id))],
      { ...params, teamSizeBonus },
    )
    return sim.simulate([1, 2, 3]).fights[0].margin
  }

  it('should strengthen opponents that bring fewer than six Pokémon', () => {
    expect(margin(3, 0.2)).toBeLessThan(margin(3, 0))
  })

  it('should leave six-Pokémon teams unchanged', () => {
    expect(margin(6, 0.2)).toBeCloseTo(margin(6, 0), 12)
  })
})

describe('type matchups', () => {
  const grassOpp = [mon(100, ['grass'], 100), mon(101, ['grass'], 100)]
  const fireTeam = [mon(1, ['fire'], 100), mon(2, ['fire'], 100)]
  const waterTeam = [mon(3, ['water'], 100), mon(4, ['water'], 100)]

  it('should favour a team with the type advantage over one without', () => {
    const sim = createSimulator(byId(...grassOpp, ...fireTeam, ...waterTeam), [fight('f', [100, 101])], params)
    const fire = sim.simulate([1, 2]).fights[0].margin
    const water = sim.simulate([3, 4]).fights[0].margin
    expect(fire).toBeGreaterThan(water)
  })

  it('should let a team with good coverage beat a higher-BST team with a shared weakness', () => {
    // four fire-type attackers against a team of water-types: a coverage hole outweighs +20% stats
    const waterOpp = [mon(100, ['water'], 100), mon(101, ['water'], 100), mon(102, ['water'], 100)]
    const holes = [1, 2, 3].map((i) => mon(i, ['fire'], 120))
    const balanced = [mon(4, ['grass'], 100), mon(5, ['electric'], 100), mon(6, ['normal'], 100)]
    const sim = createSimulator(byId(...waterOpp, ...holes, ...balanced), [fight('f', [100, 101, 102])], params)
    expect(sim.simulate([4, 5, 6]).fights[0].margin).toBeGreaterThan(sim.simulate([1, 2, 3]).fights[0].margin)
  })
})

describe('immunity abilities', () => {
  const groundOpp = [mon(100, ['ground'], 100), mon(101, ['ground'], 100)]
  const plain = [mon(1, ['electric', 'fire'], 100), mon(2, ['electric', 'fire'], 100)]
  const levitating = plain.map((e) => ({ ...e, id: e.id + 10, immunities: ['ground'] as PokemonType[] }))

  it('should help a team whose ability makes it immune to the opposing type', () => {
    const sim = createSimulator(byId(...groundOpp, ...plain, ...levitating), [fight('f', [100, 101])], params)
    expect(sim.simulate([11, 12]).fights[0].margin).toBeGreaterThan(sim.simulate([1, 2]).fights[0].margin)
  })

  it('should make opponents with an immunity ability harder to hit', () => {
    const levitatingOpp = groundOpp.map((e) => ({ ...e, id: e.id + 100, types: ['electric', 'fire'] as PokemonType[], immunities: ['ground'] as PokemonType[] }))
    const plainOpp = groundOpp.map((e) => ({ ...e, id: e.id + 200, types: ['electric', 'fire'] as PokemonType[] }))
    const team = [mon(1, ['ground'], 100), mon(2, ['ground'], 100)]
    const sim = createSimulator(
      byId(...levitatingOpp, ...plainOpp, ...team),
      [fight('lev', [200, 201]), fight('plain', [300, 301])],
      params,
    )
    const [lev, pl] = sim.simulate([1, 2]).fights
    expect(lev.margin).toBeLessThan(pl.margin)
  })

  it('should show an immune hit as no effect in the duel trace', () => {
    const sim = createSimulator(byId(...groundOpp, ...levitating), [fight('f', [100, 101])], params)
    const duels = sim.simulate([11, 12]).fights[0].trace.duels
    expect(duels.every((d) => d.opponentEffectiveness === 0)).toBe(true)
  })
})

describe('lossDrivers', () => {
  it('should blame the attacking type that hit the team super-effectively in lost fights', () => {
    const fireOpp = [mon(100, ['fire'], 100), mon(101, ['fire'], 100)]
    const grassTeam = [mon(1, ['grass'], 100), mon(2, ['grass'], 100), mon(3, ['grass'], 100)]
    const sim = createSimulator(byId(...fireOpp, ...grassTeam), [fight('f', [100, 101])], params)
    const r = sim.simulate([1, 2, 3])
    expect(r.losses).toBe(1)
    expect(r.lossDrivers[0].type).toBe('fire')
    expect(r.lossDrivers[0].share).toBeCloseTo(1)
  })

  it('should report no drivers when the team never loses', () => {
    const opp = [mon(100, ['normal'], 100)]
    const team = [mon(1, ['normal'], 300), mon(2, ['normal'], 300)]
    const sim = createSimulator(byId(...opp, ...team), [fight('f', [100])], params)
    expect(sim.simulate([1, 2]).lossDrivers).toEqual([])
  })

  it('should report no drivers when losses came without any super-effective hits', () => {
    const opp = [mon(100, ['normal'], 100), mon(101, ['normal'], 100)]
    const team = [mon(1, ['normal'], 30), mon(2, ['normal'], 30)]
    const sim = createSimulator(byId(...opp, ...team), [fight('f', [100, 101])], params)
    const r = sim.simulate([1, 2])
    expect(r.losses).toBe(1)
    expect(r.lossDrivers).toEqual([])
  })

  it('should rank drivers by share and cap at three', () => {
    const opp = [
      mon(100, ['fire'], 100),
      mon(101, ['water'], 100),
      mon(102, ['rock'], 100),
      mon(103, ['ice'], 100),
    ]
    const team = [mon(1, ['grass', 'bug'], 100), mon(2, ['grass', 'bug'], 100)]
    const sim = createSimulator(byId(...opp, ...team), [fight('f', [100, 101, 102, 103])], params)
    const { lossDrivers } = sim.simulate([1, 2])
    expect(lossDrivers.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < lossDrivers.length; i++) {
      expect(lossDrivers[i - 1].share).toBeGreaterThanOrEqual(lossDrivers[i].share)
    }
    expect(lossDrivers.reduce((s, d) => s + d.share, 0)).toBeLessThanOrEqual(1 + 1e-9)
  })
})

describe('fight trace', () => {
  const fireOpp = [mon(100, ['fire'], 100), mon(101, ['normal'], 100)]
  const team = [mon(1, ['water'], 100), mon(2, ['grass'], 100)]
  const sim = createSimulator(byId(...fireOpp, ...team), [fight('f', [100, 101], 'champion')], params)
  const { trace } = sim.simulate([1, 2]).fights[0]

  it('should list the opponents in order with their normalized stat totals', () => {
    expect(trace.opponents.map((o) => o.id)).toEqual([100, 101])
    const target = params.oppTargetBst * (1 + params.championBonus) * (1 + params.teamSizeBonus * 4)
    expect(trace.targetBst).toBeCloseTo(target, 9)
    for (const o of trace.opponents) expect(o.scaledBst).toBeCloseTo(target, 9)
  })

  it('should record each duel with who was sent out, the type matchup and who fainted', () => {
    expect(trace.duels.length).toBeGreaterThan(0)
    const first = trace.duels[0]
    expect(first.opponent).toBe(100)
    expect(first.mine).toBe(1) // water counters fire
    expect(first.myEffectiveness).toBe(2)
    expect(first.opponentEffectiveness).toBe(0.5)
    expect(first.myRate).toBeGreaterThan(first.opponentRate)
    expect(['mine', 'opponent']).toContain(first.fainted)
  })

  it('should account for all hp: what each side lost matches what is left', () => {
    const lostByMine = new Map<number, number>()
    const lostByOpp = new Map<number, number>()
    for (const d of trace.duels) {
      lostByMine.set(d.mine, (lostByMine.get(d.mine) ?? 0) + d.hpLostMine)
      lostByOpp.set(d.opponent, (lostByOpp.get(d.opponent) ?? 0) + d.hpLostOpponent)
    }
    for (const m of trace.mine) expect(m.hpLeft).toBeCloseTo(Math.max(0, 1 - (lostByMine.get(m.id) ?? 0)), 9)
    for (const o of trace.opponents) expect(o.hpLeft).toBeCloseTo(Math.max(0, 1 - (lostByOpp.get(o.id) ?? 0)), 9)
  })

  it('should end with the margin equal to remaining hp of the winning side', () => {
    const { margin, won } = sim.simulate([1, 2]).fights[0]
    const left = won
      ? trace.mine.reduce((s, m) => s + m.hpLeft, 0)
      : -trace.opponents.reduce((s, o) => s + o.hpLeft, 0)
    expect(margin).toBeCloseTo(left, 9)
  })
})

describe('fightsWon', () => {
  const grassOpp = [mon(100, ['grass'], 100), mon(101, ['grass'], 100)]
  const fireTeam = [mon(1, ['fire'], 100), mon(2, ['fire'], 100)]
  const lookup = byId(...grassOpp, ...fireTeam)
  const gauntlet = [fight('a', [100, 101]), fight('b', [101])]
  const sim = createSimulator(lookup, gauntlet, params)

  it('should return one won flag per fight matching simulate() when nothing is adjusted', () => {
    expect(sim.fightsWon([1, 2])).toEqual(sim.simulate([1, 2]).fights.map((f) => f.won))
  })

  it('should win every fight when my attacks are made overwhelming and lose them all when theirs are', () => {
    expect(sim.fightsWon([1, 2], { mine: () => 1000 })).toEqual([true, true])
    expect(sim.fightsWon([1, 2], { theirs: () => 1000 })).toEqual([false, false])
  })

  it('should pass the defender to the adjustment so it can target particular matchups', () => {
    const seen = new Set<string>()
    sim.fightsWon([1, 2], {
      mine: (best, defender) => {
        defender.types.forEach((t) => seen.add(t))
        return best
      },
    })
    expect([...seen]).toEqual(['grass'])
  })

  it('should not disturb later unadjusted results', () => {
    const before = sim.fightsWon([1, 2])
    sim.fightsWon([1, 2], { mine: () => 1000 })
    expect(sim.fightsWon([1, 2])).toEqual(before)
  })

  it('should reject empty teams', () => {
    expect(() => sim.fightsWon([])).toThrow(/team/)
  })
})
