import type { PokemonEntry } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import { SLOTS, type Roster } from '../engine/slots.ts'
import { Sprite } from './Sprite.tsx'
import { TypeBadges } from './TypeBadge.tsx'

const SLOT_LABEL = { normal: 'ANY', legend: 'LEGEND', mega: 'MEGA' } as const

interface Props {
  roster: Roster
  byId: ReadonlyMap<number, PokemonEntry>
  mode: Mode
  /** Slot indexes the currently selected Pokémon can be placed into. */
  eligible: readonly number[]
  onPlace?: (slotIndex: number) => void
}

/** The six team slots. In hard mode a placed Pokémon shows only its sprite and name. */
export function TeamBoard({ roster, byId, mode, eligible, onPlace }: Props) {
  return (
    <ol className="board" aria-label="Your team">
      {SLOTS.map((kind, i) => {
        const id = roster[i]
        const entry = id === null ? null : byId.get(id)!
        const canPlace = entry === null && eligible.includes(i)
        return (
          <li key={i}>
            <button
              type="button"
              className={`slot slot--${kind}${entry ? ' slot--filled' : ''}${canPlace ? ' slot--target' : ''}`}
              disabled={!canPlace}
              onClick={() => onPlace?.(i)}
              aria-label={entry ? `${SLOT_LABEL[kind]} slot: ${entry.name}` : `${SLOT_LABEL[kind]} slot, empty${canPlace ? ', tap to place' : ''}`}
            >
              <span className="slot__kind">{SLOT_LABEL[kind]}</span>
              {entry ? (
                <>
                  <Sprite entry={entry} size={32} />
                  <span className="slot__name">{entry.name}</span>
                  {mode === 'normal' && <TypeBadges types={entry.types} />}
                </>
              ) : (
                <span className="slot__empty">{canPlace ? 'PLACE' : '—'}</span>
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
