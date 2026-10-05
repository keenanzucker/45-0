import type { PokemonEntry } from '../data/types.ts'

export function Sprite({ entry, size = 48 }: { entry: Pick<PokemonEntry, 'sprite' | 'name'>; size?: number }) {
  return (
    <img
      className="sprite"
      src={entry.sprite}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
    />
  )
}
