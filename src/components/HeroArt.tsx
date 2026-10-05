import { useRef, useState, type AnimationEvent, type CSSProperties } from 'react'
import type { PokemonEntry } from '../data/types.ts'
import { seedRng } from '../engine/rng.ts'
import { makeFallers, pickReplacement } from '../ui/fallers.ts'
import { useCountUp } from '../ui/useCountUp.ts'

/**
 * Sprites drifting down behind the logo; purely decorative. Each time one starts over at the top it
 * becomes a different Pokémon, so the scene keeps changing. Starts from `seed`; later props are ignored.
 */
export function FallingSprites({ entries, seed, count = 14 }: { entries: readonly PokemonEntry[]; seed: number; count?: number }) {
  const [fallers, setFallers] = useState(() => makeFallers(entries, count, seed))
  const rng = useRef(seedRng(seed + 1))

  const restart = (slot: number, e: AnimationEvent<HTMLDivElement>) => {
    // The sprite's own side-to-side sway also reports its repeats; only the fall counts.
    if (e.target !== e.currentTarget) return
    const [entry, next] = pickReplacement(entries, new Set(fallers.map((f) => f.entry.id)), rng.current)
    rng.current = next
    if (entry) setFallers(fallers.map((f, i) => (i === slot ? { ...f, entry } : f)))
  }

  return (
    <div className="fall" aria-hidden="true">
      {fallers.map((f, slot) => (
        <div
          key={slot}
          className="fall__item"
          style={{ left: `${f.left}%`, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s` } as CSSProperties}
          onAnimationIteration={(e) => restart(slot, e)}
        >
          <img
            className="sprite fall__img"
            src={f.entry.sprite}
            alt=""
            width={f.size}
            height={f.size}
            draggable={false}
            style={{ animationDuration: `${f.sway}s` }}
          />
        </div>
      ))}
    </div>
  )
}

/** The 45-0 logo: the first number counts up, then a shine sweeps across it. */
export function AnimatedLogo() {
  const n = useCountUp(45, 1000)
  return (
    <h1 className="hero__logo" aria-label="45-0">
      <span className="hero__shine">
        <span className="hero__n">{n}</span>-0
      </span>
    </h1>
  )
}
