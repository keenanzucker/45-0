import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { nextInt, seedRng } from '../engine/rng.ts'

const REEL_ROWS = 14
export const REEL_ITEM_PX = 44

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

/** The values the reel scrolls through before landing on `value`; deterministic per spin id. */
function buildStrip<T>(options: readonly T[], value: T, spinId: string): T[] {
  let rng = seedRng(hash(spinId))
  const rows: T[] = []
  for (let i = 0; i < REEL_ROWS; i++) {
    let idx: number
    ;[idx, rng] = nextInt(rng, options.length)
    rows.push(options[idx])
  }
  rows.push(value)
  return rows
}

interface ReelProps<T> {
  label: string
  options: readonly T[]
  value: T
  /** Changes whenever the reel should spin again, even if it lands on the same value. */
  spinId: string
  render: (value: T) => ReactNode
  ariaValue: string
}

/** A slot-machine reel: scrolls through options and lands on `value` (CSS animation, no state). */
export function Reel<T>({ label, options, value, spinId, render, ariaValue }: ReelProps<T>) {
  const reduce = useMemo(() => prefersReducedMotion(), [])
  const strip = useMemo(
    () => (reduce ? [value] : buildStrip(options, value, spinId)),
    [options, value, spinId, reduce],
  )
  const style = { '--end': `${-(strip.length - 1) * REEL_ITEM_PX}px` } as CSSProperties
  return (
    <div className="reel" role="img" aria-label={`${label}: ${ariaValue}`}>
      <div className="reel__label">{label}</div>
      <div className="reel__window">
        {/* Remounting on a new spin restarts the CSS animation. */}
        <div key={`${spinId}:${String(value)}`} className={`reel__strip${strip.length > 1 ? ' reel__strip--spin' : ''}`} style={style}>
          {strip.map((v, i) => (
            <div className="reel__item" key={i}>
              {render(v)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A reel that has not been spun yet (the lever is waiting to be pulled). */
export function ReelBlank({ label }: { label: string }) {
  return (
    <div className="reel" role="img" aria-label={`${label}: waiting for spin`}>
      <div className="reel__label">{label}</div>
      <div className="reel__window">
        <div className="reel__item">
          <span className="reel__text reel__text--blank">?</span>
        </div>
      </div>
    </div>
  )
}
