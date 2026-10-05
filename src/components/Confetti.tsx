import type { CSSProperties } from 'react'

const COLORS = ['#e0a21a', '#d9453d', '#2f6fe0', '#2f9e5a', '#e0559a']
const PIECES = 28

/** Square confetti drifting down the screen; purely decorative. Spread and timing are fixed so it looks the same each time. */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          style={
            {
              '--x': `${(i * 37 + 11) % 100}%`,
              '--delay': `${((i * 53) % 20) / 10}s`,
              '--dur': `${2.4 + ((i * 7) % 10) / 10}s`,
              '--turn': `${((i % 2) * 2 - 1) * (360 + ((i * 29) % 360))}deg`,
              background: COLORS[i % COLORS.length],
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
