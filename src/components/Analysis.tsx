import { useState } from 'react'
import type { PokemonEntry, PokemonType } from '../data/types.ts'
import type { FightOutcome } from '../engine/simulate.ts'
import { coverage, defenseMatrix, teamContributions, type Contribution } from '../results/analysis.ts'
import { Sprite } from './Sprite.tsx'
import { TypeBadge } from './TypeBadge.tsx'

const ROWS_SHOWN = 5

const MULTIPLIER_LABEL: Record<string, string> = { '4': '×4', '2': '×2', '1': '', '0.5': '½', '0.25': '¼', '0': '0' }
const multiplierLabel = (m: number) => MULTIPLIER_LABEL[String(m)] ?? `×${m}`
const multiplierClass = (m: number) => String(m).replace('.', '_')

const oneDecimal = (n: number) => n.toFixed(1)
const capitalize = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`

interface MatrixRow {
  type: PokemonType
  multipliers: number[]
}

/** Type-by-team-member grid; shows the first rows and folds out to all 18. */
function TypeMatrix({
  caption,
  rows,
  team,
  cellClass,
}: {
  caption: string
  rows: readonly MatrixRow[]
  team: readonly PokemonEntry[]
  cellClass(multiplier: number): string
}) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? rows : rows.slice(0, ROWS_SHOWN)
  return (
    <>
      <table className="defense" aria-label={caption}>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Type</span>
            </th>
            {team.map((e) => (
              <th key={e.id} scope="col" aria-label={e.name}>
                <Sprite entry={e} size={38} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.type}>
              <th scope="row">
                <TypeBadge type={r.type} />
              </th>
              {r.multipliers.map((m, i) => (
                <td key={team[i].id} className={`mult ${cellClass(m)}`}>
                  {multiplierLabel(m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="link"
        aria-label={`${showAll ? 'Show fewer' : 'Show all 18'} ${caption.toLowerCase()}`}
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? 'Show fewer' : 'Show all 18'}
      </button>
    </>
  )
}

function Mvp({ kind, c }: { kind: 'carry' | 'weak'; c: Contribution }) {
  return (
    <div className={`mvp mvp--${kind}`}>
      <span className="mvp__tag">{kind === 'carry' ? 'CARRY' : 'WEAK LINK'}</span>
      <Sprite entry={c.entry} size={48} />
      <span className="mvp__name">{c.entry.name}</span>
      <span className="mvp__line">
        {c.knockouts} {c.knockouts === 1 ? 'KO' : 'KOs'} · fainted {c.faints}×
      </span>
      <span className="mvp__line">
        Dealt {oneDecimal(c.dealt)} · took {oneDecimal(c.taken)}
      </span>
    </div>
  )
}

interface Props {
  team: readonly PokemonEntry[]
  fights: readonly FightOutcome[]
  /** One-line summary of what cost the team its losses. */
  hurt: string
}

export function Analysis({ team, fights, hurt }: Props) {
  const { carry, weakLink } = teamContributions(team, fights)
  const defense = defenseMatrix(team)
  const cover = coverage(team)
  const missing = cover.filter((c) => !c.covered)

  return (
    <div className="analysis">
      {carry && (
        <div className="mvps">
          <Mvp kind="carry" c={carry} />
          {weakLink && <Mvp kind="weak" c={weakLink} />}
        </div>
      )}

      <p className="hurt">{hurt}</p>

      <h2 className="h2">Defense: weak spots</h2>
      <p className="analysis__note">
        Damage each type deals to your Pokémon. ×2 and ×4 are weaknesses; ½, ¼ and 0 resist.
      </p>
      <TypeMatrix
        caption="Weak spots"
        rows={defense}
        team={team}
        cellClass={(m) => `mult--${multiplierClass(m)}`}
      />

      <div className="coverage">
        <h2 className="h2">Offense: type coverage</h2>
        <p className="analysis__note">
          Which types your team can hit super-effectively, or not, with its own types (STAB).
        </p>
        <TypeMatrix caption="Type coverage" rows={cover} team={team} cellClass={(m) => `hit--${multiplierClass(m)}`} />
        <p className="cover__summary">
          {missing.length === 0
            ? 'You can hit all 18 types super effectively.'
            : `You can hit ${cover.length - missing.length} of 18 types super effectively. Missing: ${missing.map((m) => capitalize(m.type)).join(', ')}.`}
        </p>
      </div>
    </div>
  )
}
