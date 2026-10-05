import type { GauntletFight } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import type { FightOutcome } from '../engine/simulate.ts'
import { emojiForWins, titleForWins } from './titles.ts'

// Production links use 45-0.com; `npm run dev` points them at localhost through .env.development.
export const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? 'https://45-0.com'

const CODE = /^([nh])((?:\.[0-9a-z]+){6})$/

/** Compact URL-safe code for a finished team: mode letter plus six base-36 ids, e.g. "n.6.4h.2w.9z.1k.7m". */
export const encodeTeam = (mode: Mode, ids: readonly number[]): string =>
  `${mode === 'hard' ? 'h' : 'n'}.${ids.map((id) => id.toString(36)).join('.')}`

export function decodeTeam(code: string): { mode: Mode; ids: number[] } | null {
  const m = CODE.exec(code)
  if (!m) return null
  const ids = m[2].slice(1).split('.').map((s) => parseInt(s, 36))
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) return null
  return { mode: m[1] === 'h' ? 'hard' : 'normal', ids }
}

/** One square per generation: green for a clean sweep, yellow for a majority, red otherwise. */
export function genSquares(outcomes: readonly Pick<FightOutcome, 'fightId' | 'won'>[], gauntlet: readonly GauntletFight[]): string {
  const won = new Map(outcomes.map((o) => [o.fightId, o.won]))
  const gens = [...new Set(gauntlet.map((f) => f.gen))].sort((a, b) => a - b)
  return gens
    .map((gen) => {
      const fights = gauntlet.filter((f) => f.gen === gen)
      const wins = fights.filter((f) => won.get(f.id)).length
      if (wins === fights.length) return '🟩'
      return wins > fights.length / 2 ? '🟨' : '🟥'
    })
    .join('')
}

export function buildShareText(args: {
  wins: number
  losses: number
  mode: Mode
  team: readonly string[]
  url: string
}): string {
  const { wins, losses, mode, team, url } = args
  const perfect = losses === 0
  const where = `45-0${mode === 'hard' ? ' 🧠 Hard Mode' : ''}`
  const head = `I just went ${wins}–${losses} on ${where} ${emojiForWins(wins)} (${titleForWins(wins)}). Build a team that ${perfect ? 'matches' : 'beats'} it.`
  return [head, `⚔️ ${team.join(' · ')}`, `👇 ${url}`].join('\n')
}
