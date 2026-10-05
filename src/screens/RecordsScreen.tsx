import { useState } from 'react'
import type { PokemonEntry } from '../data/types.ts'
import { mostUsed, runsFor, summarize, type RecordsTab } from '../results/records.ts'
import { titleForWins, trainerSpriteForWins } from '../results/titles.ts'
import type { HistoryEntry, StatsSave } from '../state/storage.ts'
import { DsShell } from '../components/DsShell.tsx'
import { Sprite } from '../components/Sprite.tsx'

const TABS: { key: RecordsTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'normal', label: 'Normal' },
  { key: 'hard', label: 'Hard' },
]

const record = (wins: number, losses: number) => `${wins}–${losses}`

const MEDALS = [
  { icon: '🥇', label: '1st place' },
  { icon: '🥈', label: '2nd place' },
  { icon: '🥉', label: '3rd place' },
] as const

interface RunRowProps {
  run: HistoryEntry
  byId: ReadonlyMap<number, PokemonEntry>
  className: string
  onViewRun(run: HistoryEntry): void
}

function RunRow({ run, byId, className, onViewRun }: RunRowProps) {
  const title = titleForWins(run.wins)
  const team = run.team.flatMap((id) => byId.get(id) ?? [])
  const fights = run.wins + run.losses
  return (
    <details className={className}>
      <summary>
        <span className="run__mode" title={run.mode === 'hard' ? 'Hard mode' : 'Normal mode'}>
          {run.mode === 'hard' ? '🧠' : '·'}
        </span>
        <span className="run__record">{record(run.wins, run.losses)}</span>
        <span className="run__title">
          <img className="run__trainer" src={trainerSpriteForWins(run.wins)} alt="" width={28} height={28} draggable={false} />
          {title}
        </span>
        <span className="run__date">{run.date.slice(0, 10)}</span>
      </summary>
      <ul className="run__team">
        {team.map((e) => (
          <li key={e.id} className="team-card">
            <Sprite entry={e} size={48} />
            <span className="team-card__name">{e.name}</span>
            <span className="team-card__bst">{e.bst}</span>
          </li>
        ))}
      </ul>
      <p className="run__foot">
        Record {record(run.wins, run.losses)} · {title}
        {fights > 0 && ` · ${Math.round((run.wins / fights) * 100)}% of fights`}
      </p>
      {team.length === run.team.length && (
        <button type="button" className="btn btn--small run__analysis" onClick={() => onViewRun(run)}>
          FULL ANALYSIS
        </button>
      )}
    </details>
  )
}

interface Props {
  stats: StatsSave
  byId: ReadonlyMap<number, PokemonEntry>
  onBack(): void
  onViewRun(run: HistoryEntry): void
}

export function RecordsScreen({ stats, byId, onBack, onViewRun }: Props) {
  const [tab, setTab] = useState<RecordsTab>('all')
  const summary = summarize(stats, tab)
  const runs = runsFor(stats, tab)
  const podium = mostUsed(stats, tab, byId, 3)
  const mostRuns = Math.max(...summary.ranks.map((r) => r.count))

  const cells: [string, string][] = [
    ['Runs', String(summary.runs)],
    ['Best', summary.best ? record(summary.best.wins, summary.best.losses) : '–'],
    ['Average', summary.averageWins === null ? '–' : summary.averageWins.toFixed(1)],
    ['Perfect', String(summary.perfect)],
    ['Fights won', summary.fightWinRate === null ? '–' : `${Math.round(summary.fightWinRate * 100)}%`],
  ]

  return (
    <DsShell
      top={
        <div className="records-top">
          <h1 className="records-top__title">MY RECORDS</h1>
          <dl className="stat-grid">
            {cells.map(([label, value]) => (
              <div key={label} className="stat-grid__cell">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {podium.length > 0 && (
            <ol className="podium" aria-label="Most used Pokémon">
              {podium.map(({ entry, count }, i) => (
                <li key={entry.id} className={`podium__spot podium__spot--${i + 1}`}>
                  <Sprite entry={entry} size={44} />
                  <span className="podium__name">{entry.name}</span>
                  <span className="podium__count">×{count}</span>
                  <span className="podium__step">
                    <span role="img" aria-label={MEDALS[i].label}>
                      {MEDALS[i].icon}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {mostRuns > 0 && (
            <ul className="ranks" aria-label="Results by rank">
              {summary.ranks.map((r) => (
                <li key={r.title} className="rank">
                  <span className="rank__count">{r.count}</span>
                  <span className="rank__track">
                    <span className="rank__bar" style={{ height: `${Math.round((r.count / mostRuns) * 100)}%` }} />
                  </span>
                  <img className="rank__trainer" src={r.sprite} alt="" width={36} height={36} draggable={false} />
                  <span className="rank__title">{r.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
      bottom={
        <div className="records-bottom">
          <div className="records-bar">
            <button type="button" className="btn btn--small" onClick={onBack}>
              ◀ BACK
            </button>
            <div className="chips records-tabs" role="tablist" aria-label="Mode">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`chip${tab === t.key ? ' chip--on' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {summary.best && (
            <>
              <h2 className="h2">Best run</h2>
              <RunRow run={summary.best} byId={byId} className="run best-run" onViewRun={onViewRun} />
            </>
          )}

          <h2 className="h2">Recent runs</h2>
          {runs.length === 0 ? (
            <p className="records-empty">No runs yet. Finish a game and it shows up here.</p>
          ) : (
            <div className="runs">
              {runs.map((r) => (
                <RunRow key={r.date + r.mode} run={r} byId={byId} className="run" onViewRun={onViewRun} />
              ))}
            </div>
          )}
        </div>
      }
    />
  )
}
