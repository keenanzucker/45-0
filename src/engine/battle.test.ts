import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARAMS,
  attackRate,
  marginToWinProb,
  pairRates,
  runBattle,
  scaleStats,
  type Combatant,
  type SimParams,
} from './battle.ts'

const params: SimParams = {
  ...DEFAULT_PARAMS,
  stabWeight: 1.5,
  coverageFloor: 0.6,
  speedWeight: 0.25,
  statExponent: 1,
}

const mon = (
  types: Combatant['types'],
  over: Partial<Combatant['stats']> = {},
): Combatant => ({
  types,
  stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100, ...over },
})

describe('attackRate with immunity abilities', () => {
  const ground = mon(['ground'])
  const fireElectric = mon(['electric', 'fire'])

  it('should drop a quad-weak defender to the coverage floor when its ability grants the immunity', () => {
    const levitating: Combatant = { ...fireElectric, immunities: ['ground'] }
    expect(attackRate(ground, fireElectric, params)).toBeCloseTo((1.5 * 4) / 100)
    expect(attackRate(ground, levitating, params)).toBeCloseTo(0.6 / 100)
  })

  it('should not change what the immune Pokémon deals', () => {
    const levitating: Combatant = { ...fireElectric, immunities: ['ground'] }
    expect(attackRate(levitating, ground, params)).toBe(attackRate(fireElectric, ground, params))
  })
})

describe('attackRate', () => {
  it('should scale a super-effective STAB hit by 1.5 x 2 over the defender hp', () => {
    expect(attackRate(mon(['fire']), mon(['grass']), params)).toBeCloseTo(3 / 100)
  })

  it('should use the attacker best STAB type', () => {
    expect(attackRate(mon(['water', 'fire']), mon(['grass']), params)).toBeCloseTo(3 / 100)
  })

  it('should use the physical or special attack that fares better against the matching defense', () => {
    const special = mon(['normal'], { atk: 10, spa: 200 })
    const defender = mon(['normal'], { def: 100, spd: 50 })
    // neutral STAB 1.5 x max(10/100, 200/50) = 1.5 x 4
    expect(attackRate(special, defender, params)).toBeCloseTo((1.5 * 4) / 100)
  })

  it('should fall back to a neutral coverage move when STAB is resisted or immune', () => {
    expect(attackRate(mon(['normal']), mon(['ghost']), params)).toBeCloseTo(0.6 / 100)
    expect(attackRate(mon(['fire']), mon(['water', 'dragon']), params)).toBeCloseTo(0.6 / 100)
  })

  it('should keep a mildly resisted STAB hit above the coverage floor', () => {
    expect(attackRate(mon(['fire']), mon(['water']), params)).toBeCloseTo(0.75 / 100)
  })

  it('should compress stat differences with a statExponent below 1 without touching type effects', () => {
    const half = { ...params, statExponent: 0.5 }
    const base = attackRate(mon(['normal']), mon(['normal']), half)
    expect(attackRate(mon(['normal'], { atk: 400 }), mon(['normal']), half)).toBeCloseTo(base * 2)
    expect(attackRate(mon(['normal']), mon(['normal'], { hp: 400 }), half)).toBeCloseTo(base / 2)
    // super-effective STAB is still exactly 2x a neutral hit
    expect(attackRate(mon(['fire']), mon(['grass']), half)).toBeCloseTo(2 * attackRate(mon(['normal']), mon(['normal']), half))
  })

  it('should drop with more defender hp and rise with attacker power', () => {
    const base = attackRate(mon(['normal']), mon(['normal']), params)
    expect(attackRate(mon(['normal']), mon(['normal'], { hp: 200 }), params)).toBeCloseTo(base / 2)
    expect(attackRate(mon(['normal'], { atk: 200 }), mon(['normal']), params)).toBeCloseTo(base * 2)
  })
})

describe('attackRate with a STAB adjustment', () => {
  it('should let the adjustment change the best STAB multiplier, seeing the defender', () => {
    const lifted = attackRate(mon(['normal']), mon(['ghost']), params, (best, defender) =>
      defender.types.includes('ghost') ? Math.max(best, 2) : best,
    )
    expect(lifted).toBeCloseTo(3 / 100)
  })

  it('should cap a super-effective hit at neutral', () => {
    expect(attackRate(mon(['fire']), mon(['grass']), params, (best) => Math.min(best, 1))).toBeCloseTo(1.5 / 100)
  })

  it('should leave the rate alone with no adjustment', () => {
    expect(attackRate(mon(['fire']), mon(['grass']), params, undefined)).toBeCloseTo(3 / 100)
  })
})

describe('pairRates', () => {
  it('should equal the raw attack rates when speeds are equal', () => {
    const a = mon(['fire'])
    const b = mon(['grass'])
    const { ab, ba } = pairRates(a, b, params)
    expect(ab).toBeCloseTo(attackRate(a, b, params))
    expect(ba).toBeCloseTo(attackRate(b, a, params))
  })

  it('should reward the faster Pokémon and penalise the slower one', () => {
    const fast = mon(['normal'], { spe: 200 })
    const slow = mon(['normal'], { spe: 50 })
    const raw = attackRate(fast, slow, params)
    const { ab, ba } = pairRates(fast, slow, params)
    expect(ab).toBeGreaterThan(raw)
    expect(ba).toBeLessThan(raw)
  })

  it('should be mirror-symmetric', () => {
    const a = mon(['fire'], { spe: 130 })
    const b = mon(['water'], { spe: 70 })
    const forward = pairRates(a, b, params)
    const backward = pairRates(b, a, params)
    expect(forward.ab).toBeCloseTo(backward.ba)
    expect(forward.ba).toBeCloseTo(backward.ab)
  })

  it('should bound the speed effect by the speed weight', () => {
    const fast = mon(['normal'], { spe: 1000 })
    const slow = mon(['normal'], { spe: 1 })
    const raw = attackRate(fast, slow, params)
    expect(pairRates(fast, slow, params).ab).toBeLessThanOrEqual(raw * (1 + params.speedWeight) + 1e-12)
  })
})

describe('runBattle', () => {
  const rows = (...r: number[][]) => r.map((row) => Float64Array.from(row))

  it('should let the stronger lone Pokémon win and report its remaining hp as the margin', () => {
    const r = runBattle(1, 1, rows([2]), rows([1]), 0)
    expect(r.won).toBe(true)
    expect(r.margin).toBeCloseTo(0.5)
  })

  it('should report a loss with the opponent remaining hp as a negative margin', () => {
    const r = runBattle(1, 1, rows([1]), rows([2]), 0)
    expect(r.won).toBe(false)
    expect(r.margin).toBeCloseTo(-0.5)
  })

  it('should send the best counter and keep the rest of the team untouched', () => {
    // mon 0 loses to the opponent, mon 1 beats it
    const r = runBattle(2, 1, rows([1], [2]), rows([2], [1]), 0)
    expect(r.won).toBe(true)
    expect(r.margin).toBeCloseTo(1 + 0.5)
  })

  it('should carry damage between duels', () => {
    // one mon: beats opp 0 (leaving 0.5 hp) then faces opp 1 at half hp
    const ab = rows([2, 1])
    const ba = rows([1, 1.5])
    const r = runBattle(1, 2, ab, ba, 0)
    // vs opp 1: tI = 1/1 = 1, tJ = 0.5/1.5 = 1/3 -> opp 1 wins, dealing 1 * (1/3) damage
    expect(r.won).toBe(false)
    expect(r.margin).toBeCloseTo(-(1 - 1 * (1 / 3)))
  })

  it('should count unfought opponents at full hp in a losing margin', () => {
    const r = runBattle(1, 3, rows([1, 1, 1]), rows([2, 2, 2]), 0)
    expect(r.won).toBe(false)
    expect(r.margin).toBeCloseTo(-(0.5 + 1 + 1))
  })

  it('should read a column offset so several fights can share one table', () => {
    const ab = rows([9, 9, 2])
    const ba = rows([9, 9, 1])
    expect(runBattle(1, 1, ab, ba, 2).margin).toBeCloseTo(0.5)
  })

  it('should report each duel with the damage dealt both ways', () => {
    const duels: [number, number, number, number][] = []
    runBattle(1, 1, rows([2]), rows([1]), 0, (i, j, toMine, toOpp) => duels.push([i, j, toMine, toOpp]))
    expect(duels).toHaveLength(1)
    expect(duels[0][0]).toBe(0)
    expect(duels[0][1]).toBe(0)
    expect(duels[0][2]).toBeCloseTo(0.5) // damage taken by my mon
    expect(duels[0][3]).toBeCloseTo(1) // opponent fainted
  })

  it('should tell the listener which side fainted', () => {
    const fainted: boolean[] = []
    const record = (_i: number, _j: number, _a: number, _b: number, mineFainted: boolean) => fainted.push(mineFainted)
    runBattle(1, 1, rows([2]), rows([1]), 0, record)
    runBattle(1, 1, rows([1]), rows([2]), 0, record)
    expect(fainted).toEqual([false, true])
  })

  it('should report the hp each Pokémon has left', () => {
    const won = runBattle(2, 1, rows([1], [2]), rows([2], [1]), 0)
    expect(Array.from(won.mineHp)).toEqual([1, 0.5])
    expect(Array.from(won.oppHp)).toEqual([0])
    const lost = runBattle(1, 2, rows([2, 1]), rows([1, 1.5]), 0)
    expect(lost.mineHp[0]).toBe(0)
    expect(lost.oppHp[0]).toBe(0)
    expect(lost.oppHp[1]).toBeCloseTo(1 - 1 / 3)
  })
})

describe('marginToWinProb', () => {
  it('should be 0.5 at zero and monotonic in the margin', () => {
    expect(marginToWinProb(0, params)).toBeCloseTo(0.5)
    expect(marginToWinProb(1, params)).toBeGreaterThan(0.5)
    expect(marginToWinProb(-1, params)).toBeLessThan(0.5)
    expect(marginToWinProb(2, params)).toBeGreaterThan(marginToWinProb(1, params))
  })
})

describe('scaleStats', () => {
  it('should scale every stat by the same factor, preserving shape', () => {
    const s = scaleStats({ hp: 50, atk: 100, def: 60, spa: 80, spd: 40, spe: 70 }, 2)
    expect(s).toEqual({ hp: 100, atk: 200, def: 120, spa: 160, spd: 80, spe: 140 })
  })
})

describe('pairRates with adjustments', () => {
  it('should apply the mine adjustment to a→b and the theirs adjustment to b→a only', () => {
    const a = mon(['fire'])
    const b = mon(['fire'])
    const plain = pairRates(a, b, params)
    const adjusted = pairRates(a, b, params, { mine: (best) => best * 2 })
    expect(adjusted.ab).toBeCloseTo(plain.ab * 2)
    expect(adjusted.ba).toBeCloseTo(plain.ba)
    const theirs = pairRates(a, b, params, { theirs: (best) => best * 2 })
    expect(theirs.ba).toBeCloseTo(plain.ba * 2)
    expect(theirs.ab).toBeCloseTo(plain.ab)
  })
})
