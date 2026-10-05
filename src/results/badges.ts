import type { PokemonEntry } from '../data/types.ts'

export interface Badge {
  id: string
  emoji: string
  label: string
  /** One line saying what earned it. */
  hint: string
}

const MAX_BADGES = 3
const UNDERDOG_WINS = 35
/** Random drafts average a team BST of about 547 and a team speed of about 86. */
const UNDERDOG_BELOW_BST = 540
const SPEEDY_AVG_SPEED = 100
const STACKED_AVG_BST = 600

const average = (team: readonly PokemonEntry[], value: (e: PokemonEntry) => number) =>
  team.reduce((sum, e) => sum + value(e), 0) / team.length

interface Rule extends Badge {
  earned(team: readonly PokemonEntry[], wins: number): boolean
}

/** In display order; only the first few a team earns are shown. */
const RULES: readonly Rule[] = [
  {
    id: 'mono-type',
    emoji: '🔥',
    label: 'Mono-type',
    hint: 'All six share a type',
    earned: (team) => team[0].types.some((t) => team.every((e) => e.types.includes(t))),
  },
  {
    id: 'one-region',
    emoji: '🗺️',
    label: 'One-region team',
    hint: 'All six are from the same generation',
    earned: (team) => team.every((e) => e.gen === team[0].gen),
  },
  {
    id: 'world-tour',
    emoji: '🌍',
    label: 'World tour',
    hint: 'Six different generations',
    earned: (team) => new Set(team.map((e) => e.gen)).size === team.length,
  },
  {
    id: 'no-legends',
    emoji: '🚫',
    label: 'No legends',
    hint: 'Not one Legendary, Mythical, Paradox or Ultra Beast',
    earned: (team) => team.every((e) => e.category !== 'legend'),
  },
  {
    id: 'underdog',
    emoji: '🐣',
    label: 'Underdog',
    hint: `Below-average total stats, ${UNDERDOG_WINS}+ wins`,
    earned: (team, wins) => wins >= UNDERDOG_WINS && average(team, (e) => e.bst) < UNDERDOG_BELOW_BST,
  },
  {
    id: 'dual-type',
    emoji: '🪞',
    label: 'Dual-type only',
    hint: 'Every Pokémon has two types',
    earned: (team) => team.every((e) => e.types.length === 2),
  },
  {
    id: 'speed-demons',
    emoji: '⚡',
    label: 'Speed demons',
    hint: 'Very fast on average',
    earned: (team) => average(team, (e) => e.stats.spe) >= SPEEDY_AVG_SPEED,
  },
  {
    id: 'wall-of-stats',
    emoji: '🧱',
    label: 'Wall of stats',
    hint: 'Very high total stats on average',
    earned: (team) => average(team, (e) => e.bst) >= STACKED_AVG_BST,
  },
]

/** Fun tags for a finished team, earliest rule first, at most three. */
export function teamBadges(team: readonly PokemonEntry[], wins: number): Badge[] {
  if (team.length === 0) return []
  return RULES.filter((r) => r.earned(team, wins))
    .slice(0, MAX_BADGES)
    .map(({ id, emoji, label, hint }) => ({ id, emoji, label, hint }))
}
