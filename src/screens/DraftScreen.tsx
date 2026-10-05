import { useMemo, useState } from 'react'
import { POKEMON_TYPES } from '../data/types.ts'
import { canPull, canReroll, currentResults, type GameAction, type GameState } from '../engine/game.ts'
import { ERAS, type Pool } from '../engine/pool.ts'
import { placementSlots } from '../engine/slots.ts'
import { DsShell } from '../components/DsShell.tsx'
import { PickList } from '../components/PickList.tsx'
import { Lever } from '../components/Lever.tsx'
import { Reel, ReelBlank } from '../components/Reels.tsx'
import { TeamBoard } from '../components/TeamBoard.tsx'
import { TypeBadge } from '../components/TypeBadge.tsx'
import { sortAndFilter, type CategoryFilter, type SortKey } from '../ui/listing.ts'

interface Props {
  state: GameState
  pool: Pool
  dispatch(action: GameAction): void
  onQuit(): void
}

export function DraftScreen({ state, pool, dispatch, onQuit }: Props) {
  const spin = state.spin
  const placed = state.roster.filter((id) => id !== null).length
  const spinKey = `${placed}:${spin?.era}:${spin?.type}`

  // A selection belongs to one spin; any new spin clears it.
  const [selection, setSelection] = useState<{ id: number; key: string } | null>(null)
  const [sort, setSort] = useState<SortKey>('bst')
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [confirmQuit, setConfirmQuit] = useState(false)

  const selectedId = selection && selection.key === spinKey ? selection.id : null
  const selected = selectedId === null ? null : pool.byId.get(selectedId)!
  const eligible = selected ? placementSlots(state.roster, selected, pool.byId) : []

  const results = useMemo(() => currentResults(state, pool), [state, pool])
  const rows = useMemo(() => sortAndFilter(results, { mode: state.mode, sort, filter }), [results, state.mode, sort, filter])

  const place = (slotIndex: number) => {
    if (selectedId === null) return
    dispatch({ type: 'place', pokemonId: selectedId, slotIndex })
  }

  const rerollButton = (kind: 'era' | 'type') => (
    <button
      type="button"
      className="btn btn--small"
      disabled={!canReroll(state, pool, kind)}
      onClick={() => dispatch({ type: 'reroll', kind })}
      aria-label={`Reroll ${kind}`}
    >
      REROLL {kind.toUpperCase()}
      <small>{state.rerollsLeft[kind]} left</small>
    </button>
  )

  return (
    <DsShell
      top={
        <div className="draft-top">
          <div className="topbar">
            <span>PICK {Math.min(placed + 1, 6)} OF 6</span>
            {state.mode === 'hard' && <span className="badge badge--hard">🧠 HARD MODE</span>}
            {confirmQuit ? (
              <span className="quit">
                Quit run?{' '}
                <button type="button" className="link" onClick={onQuit}>Yes</button>{' / '}
                <button type="button" className="link" onClick={() => setConfirmQuit(false)}>No</button>
              </span>
            ) : (
              <button type="button" className="link" onClick={() => setConfirmQuit(true)}>QUIT</button>
            )}
          </div>
          <div className="reels" aria-live="polite">
            <div className="reels__col">
              {spin ? (
                <Reel
                  label="ERA"
                  options={ERAS}
                  value={spin.era}
                  spinId={`${placed}:${state.rerollsLeft.era}`}
                  render={(e) => <span className="reel__text">GEN {e}</span>}
                  ariaValue={`Generation ${spin.era}`}
                />
              ) : (
                <ReelBlank label="ERA" />
              )}
              {rerollButton('era')}
            </div>
            <div className="reels__col">
              {spin ? (
                <Reel
                  label="TYPE"
                  options={POKEMON_TYPES}
                  value={spin.type}
                  spinId={`${placed}:${state.rerollsLeft.type}`}
                  render={(t) => <TypeBadge type={t} />}
                  ariaValue={spin.type}
                />
              ) : (
                <ReelBlank label="TYPE" />
              )}
              {rerollButton('type')}
            </div>
            <div className="reels__lever">
              <Lever ready={canPull(state)} onPull={() => dispatch({ type: 'pull' })} />
            </div>
          </div>
          <TeamBoard roster={state.roster} byId={pool.byId} mode={state.mode} eligible={eligible} onPlace={place} />
        </div>
      }
      bottom={
        spin ? (
          <>
            <PickList
              rows={rows}
              mode={state.mode}
              sort={sort}
              filter={filter}
              selectedId={selectedId}
              roster={state.roster}
              byId={pool.byId}
              onSort={setSort}
              onFilter={setFilter}
              onSelect={(id) => setSelection({ id, key: spinKey })}
            />
            <div className={`dock${selected ? ' dock--on' : ''}`} role="status">
              {selected ? (
                <>
                  <span>
                    <b>{selected.name}</b>: tap a glowing slot on the top screen
                  </span>
                  <button type="button" className="link" onClick={() => setSelection(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <span>Tap a Pokémon to select it</span>
              )}
            </div>
          </>
        ) : (
          <div className="waiting">
            <p className="waiting__title">PULL THE LEVER</p>
            <p>
              {placed === 0
                ? 'Spin for your first era and type.'
                : `Pick ${placed} is locked in. Spin for the next era and type when you are ready.`}
            </p>
            <p className="fine">Rerolls unlock once a spin is showing.</p>
          </div>
        )
      }
    />
  )
}
