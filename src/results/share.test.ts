import { describe, expect, it } from 'vitest'
import type { GauntletFight } from '../data/types.ts'
import { buildShareText, decodeTeam, encodeTeam, genSquares } from './share.ts'

describe('encodeTeam / decodeTeam', () => {
  it('should round trip a team and mode', () => {
    const code = encodeTeam('hard', [6, 149, 10034, 1010, 25, 487])
    expect(decodeTeam(code)).toEqual({ mode: 'hard', ids: [6, 149, 10034, 1010, 25, 487] })
    expect(decodeTeam(encodeTeam('normal', [1, 2, 3, 4, 5, 6]))?.mode).toBe('normal')
  })

  it('should produce a URL-safe code', () => {
    expect(encodeTeam('normal', [6, 149, 10034, 1010, 25, 487])).toMatch(/^[nh](\.[0-9a-z]+){6}$/)
  })

  it.each(['', 'x.1.2.3.4.5.6', 'n.1.2.3.4.5', 'n.1.2.3.4.5.6.7', 'n.1.2.3.4.5.zz!', 'n.1.2.3.4.5.-1', 'garbage'])(
    'should reject malformed code %j',
    (code) => {
      expect(decodeTeam(code)).toBeNull()
    },
  )
})

const fight = (gen: number, n: number): GauntletFight => ({
  id: `g${gen}-${n}`,
  gen: gen as GauntletFight['gen'],
  region: 'R',
  name: `F${n}`,
  tier: 'e4',
  game: 'g',
  team: [1],
})
const gauntlet = Array.from({ length: 9 }, (_, g) => Array.from({ length: 5 }, (_, n) => fight(g + 1, n))).flat()
const outcomes = (winsPerGen: number[]) =>
  gauntlet.map((f) => {
    const idx = Number(f.id.split('-')[1])
    return { fightId: f.id, won: idx < winsPerGen[f.gen - 1], winProb: 0.5, margin: 0 }
  })

describe('genSquares', () => {
  it('should be green for a clean sweep, yellow for a majority, red otherwise', () => {
    expect(genSquares(outcomes([5, 4, 3, 2, 1, 0, 5, 3, 2]), gauntlet)).toBe('🟩🟨🟨🟥🟥🟥🟩🟨🟥')
  })
})

describe('buildShareText', () => {
  const base = {
    wins: 38,
    losses: 7,
    team: ['Charizard', 'Garchomp', 'Gengar', 'Mew', 'Kyogre', 'Corviknight'],
    url: 'https://45-0.com/?t=n.6.4h.2w.9z.1k.7m',
  }

  it('should say the record and rank with its emoji, challenge the reader, then list the team and link', () => {
    expect(buildShareText({ ...base, mode: 'normal' })).toBe(
      [
        'I just went 38–7 on 45-0 🥇 (Elite Four). Build a team that beats it.',
        '⚔️ Charizard · Garchomp · Gengar · Mew · Kyogre · Corviknight',
        '👇 https://45-0.com/?t=n.6.4h.2w.9z.1k.7m',
      ].join('\n'),
    )
  })

  it('should mark hard mode', () => {
    expect(buildShareText({ ...base, mode: 'hard' }).split('\n')[0]).toBe(
      'I just went 38–7 on 45-0 🧠 Hard Mode 🥇 (Elite Four). Build a team that beats it.',
    )
  })

  it('should crown a perfect run and ask the reader to match it', () => {
    const text = buildShareText({ ...base, wins: 45, losses: 0, mode: 'normal' })
    expect(text.split('\n')[0]).toBe('I just went 45–0 on 45-0 👑 (Pokémon Master). Build a team that matches it.')
  })

  it('should use the rank earned by the wins', () => {
    expect(buildShareText({ ...base, wins: 10, losses: 35, mode: 'normal' }).split('\n')[0]).toContain('🎒 (Youngster)')
  })

  it('should not repeat the 45-0 name next to the score', () => {
    expect(buildShareText({ ...base, mode: 'normal' })).not.toMatch(/45-0 · /)
  })
})
