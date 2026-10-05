import type { LegendKind, PokemonEntry } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import type { SpinEntry } from '../engine/pool.ts'
import { unavailableReason, type CategoryFilter, type SortKey } from '../ui/listing.ts'
import { Sprite } from './Sprite.tsx'
import { StatBars, StatTable } from './StatBars.tsx'
import { TypeBadges } from './TypeBadge.tsx'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'bst', label: 'BST' },
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
  { key: 'spa', label: 'SPA' },
  { key: 'spd', label: 'SPD' },
  { key: 'spe', label: 'SPE' },
  { key: 'name', label: 'A–Z' },
]

const FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'normal', label: 'Normal' },
  { key: 'legend', label: 'Legend' },
  { key: 'mega', label: 'Mega' },
]

const LEGEND_KIND_TAG: Record<LegendKind, string> = {
  'box-art': 'BOX ART',
  legendary: 'LEGENDARY',
  mythical: 'MYTHICAL',
  paradox: 'PARADOX',
  'ultra-beast': 'ULTRA BEAST',
}

/**
 * The card tag: what kind of legend-class Pokémon it is. Hard mode only says LEGEND, which is enough
 * to know it needs a legend slot.
 */
function tagFor(entry: PokemonEntry, hard: boolean): { text: string; className: string } | null {
  if (entry.category === 'mega') return { text: 'MEGA', className: 'tag--mega' }
  if (entry.category !== 'legend') return null
  const kind = entry.legendKind ?? 'legendary'
  return hard ? { text: 'LEGEND', className: 'tag--legend' } : { text: LEGEND_KIND_TAG[kind], className: `tag--${kind}` }
}

interface Props {
  rows: readonly SpinEntry[]
  mode: Mode
  sort: SortKey
  filter: CategoryFilter
  selectedId: number | null
  roster: readonly (number | null)[]
  byId: ReadonlyMap<number, PokemonEntry>
  onSort(key: SortKey): void
  onFilter(key: CategoryFilter): void
  onSelect(id: number): void
}

export function PickList({ rows, mode, sort, filter, selectedId, roster, byId, onSort, onFilter, onSelect }: Props) {
  const hard = mode === 'hard'
  return (
    <div className="picker">
      <div className="chips" role="group" aria-label="Filter by slot type">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip${filter === f.key ? ' chip--on' : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => onFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!hard && (
        <div className="chips" role="group" aria-label="Sort by">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`chip chip--sort${sort === s.key ? ' chip--on' : ''}`}
              aria-pressed={sort === s.key}
              onClick={() => onSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <ul className="picklist">
        {rows.length === 0 && <li className="picklist__empty">Nothing in this filter.</li>}
        {rows.map(({ entry, selectable }) => {
          const selected = entry.id === selectedId
          const tag = tagFor(entry, hard)
          return (
            <li key={entry.id}>
              <button
                type="button"
                className={`pick${selected ? ' pick--selected' : ''}${selectable ? '' : ' pick--dim'}`}
                disabled={!selectable}
                aria-pressed={selected}
                onClick={() => onSelect(entry.id)}
              >
                <Sprite entry={entry} size={hard ? 56 : 48} />
                <span className="pick__main">
                  <span className="pick__name">{entry.name}</span>
                  {!hard && <TypeBadges types={entry.types} />}
                  {tag && <span className={`tag ${tag.className}`}>{tag.text}</span>}
                  {!selectable && <span className="pick__why">{unavailableReason(entry, roster, byId)}</span>}
                </span>
                {!hard && (
                  <span className="pick__stats">
                    <span className="pick__bst">{entry.bst}</span>
                    <StatBars stats={entry.stats} />
                  </span>
                )}
              </button>
              {selected && !hard && <StatTable stats={entry.stats} bst={entry.bst} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
