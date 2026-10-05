import type { Stats } from '../data/types.ts'
import { STAT_KEYS as KEYS, STAT_LABELS } from '../ui/labels.ts'

/** Six compact vertical bars (HP/Atk/Def/SpA/SpD/Spe); height is relative to a 160 base stat. */
export function StatBars({ stats }: { stats: Stats }) {
  return (
    <span className="bars" role="img" aria-label={KEYS.map((k) => `${STAT_LABELS[k]} ${stats[k]}`).join(', ')}>
      {KEYS.map((k) => (
        <span key={k} className="bars__bar" title={`${STAT_LABELS[k]} ${stats[k]}`}>
          <span
            className={`bars__fill bars__fill--${stats[k] >= 110 ? 'hi' : stats[k] >= 70 ? 'mid' : 'lo'}`}
            style={{ height: `${Math.min(100, (stats[k] / 160) * 100)}%` }}
          />
        </span>
      ))}
    </span>
  )
}

export function StatTable({ stats, bst }: { stats: Stats; bst: number }) {
  return (
    <dl className="stat-table">
      {KEYS.map((k) => (
        <div key={k}>
          <dt>{STAT_LABELS[k]}</dt>
          <dd>{stats[k]}</dd>
        </div>
      ))}
      <div className="stat-table__total">
        <dt>BST</dt>
        <dd>{bst}</dd>
      </div>
    </dl>
  )
}
