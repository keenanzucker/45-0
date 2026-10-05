import type { PokemonEntry } from '../data/types.ts'
import { teamBadges } from '../results/badges.ts'

/** Fun tags a finished team has earned; nothing is drawn when it has earned none. */
export function TeamBadges({ team, wins }: { team: readonly PokemonEntry[]; wins: number }) {
  const badges = teamBadges(team, wins)
  if (badges.length === 0) return null
  return (
    <ul className="badges" aria-label="Team badges">
      {badges.map((b) => (
        <li key={b.id} className="badges__chip" title={b.hint}>
          <span aria-hidden="true">{b.emoji}</span>
          {b.label}
        </li>
      ))}
    </ul>
  )
}
