import type { CSSProperties } from 'react'
import type { PokemonEntry } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import { titleForWins, trainerSpriteForWins } from '../results/titles.ts'
import { useCountUp } from '../ui/useCountUp.ts'
import { Sprite } from './Sprite.tsx'
import { TypeTag } from './TypeBadge.tsx'

/** One team member on the top screen; squares pop in one after another. */
function HofMon({ entry, index }: { entry: PokemonEntry; index: number }) {
  return (
    <li className="hof__mon" style={{ '--i': index } as CSSProperties}>
      <span className="hof__name">
        <span>{entry.name}</span>
      </span>
      <Sprite entry={entry} size={56} />
      <span className="hof__bst">BST {entry.bst}</span>
      <span className="ttags">
        {entry.types.map((t) => (
          <TypeTag key={t} type={t} />
        ))}
      </span>
    </li>
  )
}

interface Props {
  team: readonly PokemonEntry[]
  wins: number
  losses: number
  mode: Mode
}

/** Hall of Fame top screen: the team around the record, the earned trainer and title. */
export function ResultTop({ team, wins, losses, mode }: Props) {
  const shown = useCountUp(wins)
  return (
    <div className="result-top">
      <ul className="hof__row" aria-label="Your team">
        {team.slice(0, 3).map((e, i) => (
          <HofMon key={e.id} entry={e} index={i} />
        ))}
      </ul>
      <div className="hof__center">
        {mode === 'hard' && <div className="badge badge--hard">🧠 HARD MODE</div>}
        <div className="result__rank">
          <img className="result__trainer" src={trainerSpriteForWins(wins)} alt="" width={64} height={64} draggable={false} />
          <div className="result__score">
            <div className="result__record" aria-label={`Record ${wins} wins, ${losses} losses`}>
              {shown}–{shown === wins ? losses : 45 - shown}
            </div>
            <div className="result__title">{titleForWins(wins)}</div>
          </div>
        </div>
      </div>
      <ul className="hof__row" aria-label="Your team, continued">
        {team.slice(3).map((e, i) => (
          <HofMon key={e.id} entry={e} index={i + 3} />
        ))}
      </ul>
    </div>
  )
}
