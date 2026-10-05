import { describe, expect, it } from 'vitest'
import type { PokemonEntry } from '../../src/data/types.ts'
import { buildFight, type FightConfig } from './gauntlet.ts'
import type { ParsedMon, ParsedTrainer } from './trainers.ts'

const e = (id: number, slug: string): PokemonEntry => ({
  id,
  slug,
  name: slug,
  speciesId: id,
  gen: 1,
  types: ['normal'],
  stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
  bst: 6,
  category: 'normal',
  isStarter: false,
  isFinal: true,
  sprite: `/sprites/${id}.png`,
})

const pool = [
  e(87, 'dewgong'),
  e(91, 'cloyster'),
  e(80, 'slowbro'),
  e(124, 'jynx'),
  e(131, 'lapras'),
  e(6, 'charizard'),
  e(9, 'blastoise'),
]

const pdbMon = (dex: number, slug: string): ParsedMon => ({ slug, dex, level: 50 })
const dittoMon = (dex: number, slug: string): ParsedMon => ({ slug, dex, level: 50 })

const pdbLorelei: ParsedTrainer = {
  id: 'elite4-1',
  name: 'Lorelei',
  team: [pdbMon(87, 'dewgong'), pdbMon(91, 'cloyster'), pdbMon(80, 'slowbro')],
}
const dittoLorelei: ParsedTrainer = {
  id: 'lorelei',
  name: 'Lorelei',
  team: [dittoMon(80, 'slowbro'), dittoMon(87, 'dewgong'), dittoMon(91, 'cloyster')],
}

const cfg: FightConfig = {
  id: 'g1-lorelei',
  name: 'Lorelei',
  tier: 'e4',
  pdb: { section: 'elite4', name: 'Lorelei' },
  ditto: { id: 'lorelei' },
}
const ctx = { gen: 1 as const, region: 'Kanto', game: 'red-blue' }

describe('buildFight', () => {
  it('should mark fights both sources agree on, ignoring order, and keep PokémonDB order', () => {
    const r = buildFight(cfg, ctx, [pdbLorelei], [dittoLorelei], pool, {})
    expect(r.status).toBe('both-agree')
    expect(r.fight).toEqual({
      id: 'g1-lorelei',
      gen: 1,
      region: 'Kanto',
      name: 'Lorelei',
      tier: 'e4',
      game: 'red-blue',
      team: [87, 91, 80],
    })
  })

  it('should flag conflicts, use the PokémonDB team, and name the differences', () => {
    const differing: ParsedTrainer = {
      ...dittoLorelei,
      team: [dittoMon(87, 'dewgong'), dittoMon(91, 'cloyster'), dittoMon(124, 'jynx')],
    }
    const r = buildFight(cfg, ctx, [pdbLorelei], [differing], pool, {})
    expect(r.status).toBe('conflict')
    expect(r.fight.team).toEqual([87, 91, 80])
    expect(r.notes.join(' ')).toMatch(/slowbro/)
    expect(r.notes.join(' ')).toMatch(/jynx/)
  })

  it('should use the only configured source and mark it single-source', () => {
    const r = buildFight({ ...cfg, pdb: undefined }, ctx, [], [dittoLorelei], pool, {})
    expect(r.status).toBe('single-source')
    expect(r.fight.team).toEqual([80, 87, 91])
  })

  it('should only match the PokémonDB trainer in the configured section', () => {
    const kahuna: ParsedTrainer = { id: 'kahuna-1', name: 'Lorelei', team: [pdbMon(131, 'lapras')] }
    const r = buildFight(cfg, ctx, [kahuna, pdbLorelei], [dittoLorelei], pool, {})
    expect(r.fight.team).toEqual([87, 91, 80])
  })

  it('should pick the team whose variant matches, case-insensitively, and record it', () => {
    const variantCfg: FightConfig = {
      id: 'g1-blue',
      name: 'Blue',
      tier: 'champion',
      pdb: { section: 'champion', name: 'Blue' },
      ditto: { id: 'blue' },
      variant: { pdb: 'bulbasaur', ditto: 'bulbasaur' },
    }
    const pdb: ParsedTrainer[] = [
      { id: 'champion-5', name: 'Blue', variant: 'Charmander as starter', team: [pdbMon(9, 'blastoise')] },
      { id: 'champion-5', name: 'Blue', variant: 'Bulbasaur as starter', team: [pdbMon(6, 'charizard')] },
    ]
    const ditto: ParsedTrainer[] = [
      { id: 'blue', name: 'Blue', variant: 'player-picked-squirtle', team: [dittoMon(9, 'blastoise')] },
      { id: 'blue', name: 'Blue', variant: 'player-picked-bulbasaur', team: [dittoMon(6, 'charizard')] },
    ]
    const r = buildFight(variantCfg, ctx, pdb, ditto, pool, {})
    expect(r.status).toBe('both-agree')
    expect(r.fight.team).toEqual([6])
    expect(r.fight.variant).toBe('Bulbasaur as starter')
  })

  it('should take the first listed team when no variant is configured', () => {
    const pdb: ParsedTrainer[] = [
      { id: 'elite4-1', name: 'Lorelei', variant: 'A', team: [pdbMon(87, 'dewgong')] },
      { id: 'elite4-1', name: 'Lorelei', variant: 'B', team: [pdbMon(91, 'cloyster')] },
    ]
    const r = buildFight({ ...cfg, ditto: undefined }, ctx, pdb, [], pool, {})
    expect(r.fight.team).toEqual([87])
    expect(r.fight.variant).toBe('A')
  })

  it('should apply manual fixes by pool slug and mark them manual', () => {
    const r = buildFight(cfg, ctx, [pdbLorelei], [dittoLorelei], pool, {
      'g1-lorelei': ['lapras', 'jynx'],
    })
    expect(r.status).toBe('manual')
    expect(r.fight.team).toEqual([131, 124])
  })

  it('should throw when a configured trainer is missing from a source', () => {
    expect(() => buildFight(cfg, ctx, [], [dittoLorelei], pool, {})).toThrow(/g1-lorelei.*PokémonDB/)
    expect(() => buildFight(cfg, ctx, [pdbLorelei], [], pool, {})).toThrow(/g1-lorelei.*DittoBase/)
  })

  it('should throw when a fix names an unknown slug', () => {
    expect(() =>
      buildFight(cfg, ctx, [pdbLorelei], [dittoLorelei], pool, { 'g1-lorelei': ['missingno'] }),
    ).toThrow(/missingno/)
  })

  it('should throw for empty or oversized teams', () => {
    expect(() =>
      buildFight(cfg, ctx, [{ ...pdbLorelei, team: [] }], [{ ...dittoLorelei, team: [] }], pool, {}),
    ).toThrow(/team size/)
    const seven = Array.from({ length: 7 }, () => pdbMon(87, 'dewgong'))
    expect(() =>
      buildFight({ ...cfg, ditto: undefined }, ctx, [{ ...pdbLorelei, team: seven }], [], pool, {}),
    ).toThrow(/team size/)
  })
})
