import { useRef, useState, type AnimationEvent, type CSSProperties } from 'react'
import type { PokemonEntry } from '../data/types.ts'
import { seedRng } from '../engine/rng.ts'
import { makeBurst, type BurstSprite } from '../ui/burst.ts'
import { makeFallers, pickReplacement } from '../ui/fallers.ts'
import { prefersReducedMotion } from '../ui/motion.ts'
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

const BURST_SIZE = 10
const MAX_BURSTS = 3

/**
 * The 45-0 logo: the first number counts up, then a shine sweeps across it. Tapping it throws out a
 * burst of Pokémon from `entries`.
 */
export function AnimatedLogo({ entries = [] }: { entries?: readonly PokemonEntry[] }) {
  const n = useCountUp(45, 1000)
  const [bursts, setBursts] = useState<{ id: number; sprites: BurstSprite[] }[]>([])
  const nextId = useRef(0)

  const tap = () => {
    if (entries.length === 0 || prefersReducedMotion()) return
    const id = nextId.current++
    const sprites = makeBurst(entries, BURST_SIZE, Math.floor(Math.random() * 2 ** 31))
    setBursts((current) => [...current, { id, sprites }].slice(-MAX_BURSTS))
  }
  const clear = (id: number) => (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setBursts((current) => current.filter((b) => b.id !== id))
  }

  return (
    <h1 className="hero__logo" aria-label="45-0" onClick={tap}>
      <span className="hero__shine">
        <span className="hero__n">{n}</span>-0
      </span>
      {bursts.map((b) => (
        <div key={b.id} className="burst" aria-hidden="true">
          {b.sprites.map((s, i) => (
            <div
              key={i}
              className="burst__item"
              style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, '--spin': `${s.spin}deg` } as CSSProperties}
              onAnimationEnd={i === 0 ? clear(b.id) : undefined}
            >
              <img className="sprite" src={s.entry.sprite} alt="" width={s.size} height={s.size} draggable={false} />
            </div>
          ))}
        </div>
      ))}
    </h1>
  )
}
