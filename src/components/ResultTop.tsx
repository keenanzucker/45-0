import { useState, type AnimationEvent, type CSSProperties } from 'react'
import type { PokemonEntry } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import { titleForWins, trainerSpriteForWins } from '../results/titles.ts'
import { prefersReducedMotion } from '../ui/motion.ts'
import { useCountUp } from '../ui/useCountUp.ts'
import { Confetti } from './Confetti.tsx'
import { Sprite } from './Sprite.tsx'
import { TypeTag } from './TypeBadge.tsx'

const SPIN_EVERY = 10

/** One team member on the top screen; squares pop in one after another. Tapping the sprite makes it hop. */
function HofMon({ entry, index, crowned }: { entry: PokemonEntry; index: number; crowned: boolean }) {
  const [taps, setTaps] = useState(0)
  const [moving, setMoving] = useState(false)

  const tap = () => {
    if (moving || prefersReducedMotion()) return
    setTaps(taps + 1)
    setMoving(true)
  }
  const settle = (e: AnimationEvent<HTMLSpanElement>) => {
    // The idle bob on the image never ends; only the hop reports back here.
    if (e.target === e.currentTarget) setMoving(false)
  }
  const move = taps % SPIN_EVERY === 0 ? 'spin' : 'hop'

  return (
    <li className="hof__mon" style={{ '--i': index } as CSSProperties}>
      <span className="hof__name">
        <span>{entry.name}</span>
      </span>
      <span className={`hof__sprite${moving ? ` hof__sprite--${move}` : ''}`} onClick={tap} onAnimationEnd={settle}>
        {crowned && <span className="hof__crown">👑</span>}
        <Sprite entry={entry} size={56} />
      </span>
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
  const perfect = losses === 0
  return (
    <div className="result-top">
      {perfect && <Confetti />}
      <ul className="hof__row" aria-label="Your team">
        {team.slice(0, 3).map((e, i) => (
          <HofMon key={e.id} entry={e} index={i} crowned={perfect} />
        ))}
      </ul>
      <div className="hof__center">
        {mode === 'hard' && <div className="badge badge--hard">🧠 HARD MODE</div>}
        <div className="result__rank">
          <img className="result__trainer" src={trainerSpriteForWins(wins)} alt="" width={64} height={64} draggable={false} />
          <div className="result__score">
            <div className={`result__record${perfect ? ' result__record--gold' : ''}`} aria-label={`Record ${wins} wins, ${losses} losses`}>
              {shown}–{shown === wins ? losses : 45 - shown}
            </div>
            <div className="result__title">{titleForWins(wins)}</div>
          </div>
        </div>
      </div>
      <ul className="hof__row" aria-label="Your team, continued">
        {team.slice(3).map((e, i) => (
          <HofMon key={e.id} entry={e} index={i + 3} crowned={perfect} />
        ))}
      </ul>
    </div>
  )
}
