import type { GauntletFight, PokemonEntry } from '../data/types.ts'
import type { FightOutcome } from '../engine/simulate.ts'
import { genSquares } from '../results/share.ts'

const SQUARE_CLASS: Record<string, string> = { '🟩': 'sq--g', '🟨': 'sq--y', '🟥': 'sq--r' }

interface Props {
  gauntlet: readonly GauntletFight[]
  outcomes: readonly FightOutcome[]
  byId: ReadonlyMap<number, PokemonEntry>
}

/** Result squares per generation, then every fight grouped by generation. */
export function FightsList({ gauntlet, outcomes, byId }: Props) {
  const outcomeById = new Map(outcomes.map((o) => [o.fightId, o]))
  const gens = [...new Set(gauntlet.map((f) => f.gen))].sort((a, b) => a - b)
  const squares = [...genSquares(outcomes, gauntlet)]

  return (
    <div className="fights">
      <h2 className="h2">Fights</h2>
      <div className="squares" aria-label="Results by generation">
        {squares.map((sq, i) => (
          <span key={gens[i]} className={`sq ${SQUARE_CLASS[sq]}`}>
            G{gens[i]}
          </span>
        ))}
      </div>
      {gens.map((gen) => {
        const fights = gauntlet.filter((f) => f.gen === gen)
        const wins = fights.filter((f) => outcomeById.get(f.id)?.won).length
        return (
          <details key={gen} className="gen">
            <summary>
              <span>
                Gen {gen} · {fights[0].region}
              </span>
              <span className={wins === fights.length ? 'win' : wins > fights.length / 2 ? 'meh' : 'loss'}>
                {wins}/{fights.length}
              </span>
            </summary>
            <ul>
              {fights.map((f) => {
                const won = outcomeById.get(f.id)?.won
                return (
                  <li key={f.id} className={won ? 'win' : 'loss'}>
                    <span>
                      {won ? '✔' : '✖'} {f.name}
                    </span>
                    <span className="gen__team">{f.team.map((id) => byId.get(id)?.name ?? `#${id}`).join(', ')}</span>
                  </li>
                )
              })}
            </ul>
          </details>
        )
      })}
    </div>
  )
}
