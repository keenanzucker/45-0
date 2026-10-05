import type { PokemonType } from '../data/types.ts'
import { TYPE_ABBR } from '../ui/labels.ts'

export function TypeBadge({ type }: { type: PokemonType }) {
  return <span className={`type type--${type}`}>{type}</span>
}

export function TypeBadges({ types }: { types: readonly PokemonType[] }) {
  return (
    <span className="types">
      {types.map((t) => (
        <TypeBadge key={t} type={t} />
      ))}
    </span>
  )
}

/** Compact colored type tag; the full name is in the tooltip and the accessible name. */
export function TypeTag({ type }: { type: PokemonType }) {
  return (
    <span className={`type ttag type--${type}`} title={type} aria-label={type}>
      {TYPE_ABBR[type]}
    </span>
  )
}
