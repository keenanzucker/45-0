import { useMemo, useState } from 'react'
import type { GauntletFight, PokemonEntry } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import type { Simulator } from '../engine/simulate.ts'
import { useBattleLog } from '../results/useBattleLog.ts'
import { buildShareText, encodeTeam, SITE_URL } from '../results/share.ts'
import { Breakdown } from '../components/Breakdown.tsx'
import { DsShell } from '../components/DsShell.tsx'
import { ResultTop } from '../components/ResultTop.tsx'
import { TeamBadges } from '../components/TeamBadges.tsx'

interface Props {
  team: number[]
  mode: Mode
  byId: ReadonlyMap<number, PokemonEntry>
  gauntlet: readonly GauntletFight[]
  sim: Simulator
  /** Viewing a past run from the records; replaces the play-again button. */
  onBack?(): void
  onPlayAgain?(): void
}

export function ResultsScreen({ team, mode, byId, gauntlet, sim, onBack, onPlayAgain }: Props) {
  const result = useMemo(() => sim.simulate(team), [sim, team])
  useBattleLog(result, gauntlet, byId)
  const [toast, setToast] = useState<string | null>(null)

  const entries = useMemo(() => team.map((id) => byId.get(id)!), [team, byId])

  const share = async () => {
    const text = buildShareText({
      wins: result.wins,
      losses: result.losses,
      mode,
      team: entries.map((e) => e.name),
      url: `${SITE_URL}/?t=${encodeTeam(mode, team)}`,
    })
    try {
      if (typeof navigator.share === 'function' && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setToast('Copied to clipboard!')
    } catch {
      setToast('Could not share. Copy it manually.')
    }
    window.setTimeout(() => setToast(null), 2500)
  }

  return (
    <DsShell
      top={<ResultTop team={entries} wins={result.wins} losses={result.losses} mode={mode} />}
      bottom={
        <div className="result-bottom">
          <div className="result-scroll">
            <h2 className="h2 h2--center">Analysis</h2>
            <TeamBadges team={entries} wins={result.wins} />
            <Breakdown team={entries} result={result} sim={sim} byId={byId} gauntlet={gauntlet} />
          </div>

          <div className="result-actions">
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={share}>SHARE</button>
              {onBack ? (
                <button type="button" className="btn" onClick={onBack}>◀ BACK</button>
              ) : (
                <button type="button" className="btn" onClick={onPlayAgain}>PLAY AGAIN</button>
              )}
            </div>
            {toast && <div className="toast" role="status">{toast}</div>}
          </div>
        </div>
      }
    />
  )
}
