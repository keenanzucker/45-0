import { describe, expect, it } from 'vitest'
import { POKEMON_TYPES, type FightTier, type GauntletFight, type PokemonEntry, type PokemonType } from '../data/types.ts'
import { DEFAULT_PARAMS } from '../engine/battle.ts'
import { createSimulator, type DuelTrace, type FightOutcome } from '../engine/simulate.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { coverage, defenseMatrix, teamContributions } from './analysis.ts'

const mon = (id: number, types: PokemonType[]) => mkEntry(id, 1, types, { name: `M${id}` })

describe('defenseMatrix', () => {
  const team = [mon(1, ['fire', 'flying']), mon(2, ['water']), mon(3, ['ghost'])]
  const rows = defenseMatrix(team)
  const row = (t: PokemonType) => rows.find((r) => r.type === t)!

  it('should have one row per type with a multiplier for each team member', () => {
    expect(rows.map((r) => r.type).sort()).toEqual([...POKEMON_TYPES].sort())
    for (const r of rows) expect(r.multipliers).toHaveLength(team.length)
  })

  it('should multiply dual types, including quad weaknesses and immunities', () => {
    expect(row('rock').multipliers).toEqual([4, 1, 1])
    expect(row('ground').multipliers).toEqual([0, 1, 1])
    expect(row('water').multipliers).toEqual([2, 0.5, 1])
    expect(row('normal').multipliers).toEqual([1, 1, 0])
    expect(row('fire').multipliers).toEqual([0.5, 0.5, 1])
  })

  it('should show an ability immunity as a 0 multiplier that is neither a weakness nor missing', () => {
    const levitator = mkEntry(9, 1, ['electric', 'fire'], { name: 'Levitator', immunities: ['ground'] })
    const plain = mkEntry(8, 1, ['electric', 'fire'], { name: 'Plain' })
    const ground = defenseMatrix([levitator, plain]).find((r) => r.type === 'ground')!
    expect(ground.multipliers).toEqual([0, 4])
    expect(ground.weak).toBe(1)
    expect(ground.resist).toBe(1)
  })

  it('should count weaknesses and resistances (immunities resist)', () => {
    expect(row('rock')).toMatchObject({ weak: 1, resist: 0 })
    expect(row('water')).toMatchObject({ weak: 1, resist: 1 })
    expect(row('ground')).toMatchObject({ weak: 0, resist: 1 })
    expect(row('normal')).toMatchObject({ weak: 0, resist: 1 })
  })

  it('should put the most exposed types first, breaking ties by fewer resistances', () => {
    const exposed = defenseMatrix([mon(1, ['grass']), mon(2, ['bug']), mon(3, ['ice'])])
    expect(exposed[0].type).toBe('fire') // all three weak to fire
    expect(exposed[0].weak).toBe(3)
    for (let i = 1; i < exposed.length; i++) {
      const a = exposed[i - 1]
      const b = exposed[i]
      expect(a.weak > b.weak || (a.weak === b.weak && a.resist <= b.resist)).toBe(true)
    }
  })
})

describe('coverage', () => {
  const team = [mon(1, ['fire', 'fighting']), mon(2, ['bug', 'water']), mon(3, ['steel'])]
  const rows = coverage(team)
  const row = (t: PokemonType) => rows.find((r) => r.type === t)!

  it('should have one row per defending type with a multiplier for each team member', () => {
    expect(rows.map((r) => r.type).sort()).toEqual([...POKEMON_TYPES].sort())
    for (const r of rows) expect(r.multipliers).toHaveLength(team.length)
  })

  it('should use each member’s best own-type multiplier against a pure defender', () => {
    expect(row('grass').multipliers).toEqual([2, 2, 1]) // fire and bug hit grass; steel is neutral
    expect(row('ice').multipliers).toEqual([2, 1, 2]) // fire and steel hit ice; bug/water do not
    expect(row('water').multipliers).toEqual([1, 1, 0.5]) // fighting and bug are neutral, steel is resisted
  })

  it('should show resisted and immune matchups', () => {
    const normal = coverage([mon(1, ['normal'])])
    expect(normal.find((r) => r.type === 'ghost')!.multipliers).toEqual([0])
    expect(normal.find((r) => r.type === 'steel')!.multipliers).toEqual([0.5])
  })

  it('should count the members that hit super-effectively and mark covered types', () => {
    expect(row('grass')).toMatchObject({ coveredBy: 2, covered: true })
    expect(row('ice')).toMatchObject({ coveredBy: 2, covered: true }) // fire and steel
    expect(row('water')).toMatchObject({ coveredBy: 0, covered: false })
  })

  it('should list the least covered types first', () => {
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].coveredBy).toBeLessThanOrEqual(rows[i].coveredBy)
    expect(rows[0].covered).toBe(false)
  })

  it('should count a dual-typed attacker for both of its types', () => {
    const dual = coverage([mon(1, ['fire', 'water'])])
    expect(dual.find((x) => x.type === 'rock')!.covered).toBe(true)
    expect(dual.find((x) => x.type === 'grass')!.covered).toBe(true)
  })
})

describe('teamContributions', () => {
  const duel = (mine: number, over: Partial<DuelTrace> = {}): DuelTrace => ({
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
  const fightOf = (duels: DuelTrace[]): FightOutcome => ({
    fightId: 'f',
    winProb: 0.5,
    margin: 1,
    won: true,
    trace: { targetBst: 600, opponents: [], mine: [], duels },
  })
  const team = [mon(1, ['fire']), mon(2, ['water']), mon(3, ['grass'])]

  it('should total each Pokémon’s knockouts, damage dealt and damage taken across all fights', () => {
    const fights = [
      fightOf([duel(1, { hpLostOpponent: 1, hpLostMine: 0.2 }), duel(2, { hpLostOpponent: 0.5, hpLostMine: 1, fainted: 'mine' })]),
      fightOf([duel(1, { hpLostOpponent: 1, hpLostMine: 0.3 })]),
    ]
    const { stats } = teamContributions(team, fights)
    expect(stats.find((s) => s.entry.id === 1)).toMatchObject({ knockouts: 2, fights: 2, faints: 0 })
    expect(stats.find((s) => s.entry.id === 1)!.dealt).toBeCloseTo(2)
    expect(stats.find((s) => s.entry.id === 1)!.taken).toBeCloseTo(0.5)
    expect(stats.find((s) => s.entry.id === 2)).toMatchObject({ knockouts: 0, fights: 1, faints: 1 })
    expect(stats.find((s) => s.entry.id === 3)).toMatchObject({ knockouts: 0, fights: 0, dealt: 0, taken: 0 })
  })

  it('should name the carry as the biggest net hp swing and the weak link as the smallest', () => {
    const fights = [
      fightOf([
        duel(1, { hpLostOpponent: 3, hpLostMine: 0.5 }),
        duel(2, { hpLostOpponent: 0.2, hpLostMine: 1.5, fainted: 'mine' }),
        duel(3, { hpLostOpponent: 1, hpLostMine: 0.2 }),
      ]),
    ]
    const { carry, weakLink } = teamContributions(team, fights)
    expect(carry?.entry.id).toBe(1)
    expect(weakLink?.entry.id).toBe(2)
    expect(carry!.net).toBeCloseTo(2.5)
    expect(weakLink!.net).toBeCloseTo(-1.3)
  })

  it('should not name a weak link when it would be the carry', () => {
    const fights = [fightOf([duel(1, { hpLostOpponent: 1, hpLostMine: 0.1 })])]
    const solo = teamContributions([mon(1, ['fire'])], fights)
    expect(solo.carry?.entry.id).toBe(1)
    expect(solo.weakLink).toBeNull()
  })

  it('should break ties by team order', () => {
    const { carry, weakLink } = teamContributions(team, [fightOf([])])
    expect(carry?.entry.id).toBe(1)
    expect(weakLink?.entry.id).toBe(3)
  })

  it('should agree with a real simulation: every duel is attributed to a team member', () => {
    const flat = (v: number) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v })
    const real = [mon(1, ['water']), mon(2, ['grass']), mon(100, ['fire']), mon(101, ['normal'])].map(
      (e) => ({ ...e, stats: flat(100), bst: 600 }) as PokemonEntry,
    )
    const gauntlet: GauntletFight[] = [
      { id: 'a', gen: 1, region: 'T', name: 'a', tier: 'e4' as FightTier, game: 't', team: [100, 101] },
    ]
    const sim = createSimulator(new Map(real.map((e) => [e.id, e])), gauntlet, DEFAULT_PARAMS)
    const fights = sim.simulate([1, 2]).fights
    const { stats } = teamContributions([real[0], real[1]], fights)
    const duels = fights.flatMap((f) => f.trace.duels)
    expect(stats.reduce((s, x) => s + x.dealt, 0)).toBeCloseTo(duels.reduce((s, d) => s + d.hpLostOpponent, 0))
    expect(stats.reduce((s, x) => s + x.taken, 0)).toBeCloseTo(duels.reduce((s, d) => s + d.hpLostMine, 0))
  })
})
