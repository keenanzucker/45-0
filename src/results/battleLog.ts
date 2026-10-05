import type { GauntletFight, PokemonEntry } from '../data/types.ts'
import type { DuelTrace, FightOutcome, SimulationResult } from '../engine/simulate.ts'

type Sink = Pick<Console, 'groupCollapsed' | 'groupEnd' | 'log' | 'table'>

const RULE =
  'A fight is won (margin > 0) when any of your Pokémon is standing after every opponent has fainted. ' +
  'Margin = your remaining hp on a win, minus the hp the opponents have left on a loss (1 = one full-hp Pokémon). ' +
  'Each duel: you send the living Pokémon with the best hp × rate ratio against the current opponent; ' +
  'the side that needs fewer attacks (hp ÷ rate) to finish the other faints first, and damage carries over. ' +
  'Win prob = 1 / (1 + e^(-margin / marginScale)) is shown for context; it does not decide the result.'

const hp = (n: number) => n.toFixed(2)
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(2)}`

export function describeFight(
  fight: GauntletFight,
  outcome: FightOutcome,
  byId: ReadonlyMap<number, PokemonEntry>,
): { title: string; lines: string[] } {
  const name = (id: number) => byId.get(id)?.name ?? `#${id}`
  const { trace } = outcome
  const result = outcome.won ? 'WON ' : 'LOST'
  const title =
    `${result} G${fight.gen} ${fight.region} · ${fight.name} (${fight.tier}) · ` +
    `margin ${signed(outcome.margin)} · win prob ${Math.round(outcome.winProb * 100)}%`

  const duel = (d: DuelTrace) => {
    const faintedName = name(d.fainted === 'mine' ? d.mine : d.opponent)
    return (
      `${name(d.mine)} vs ${name(d.opponent)}: STAB x${d.myEffectiveness} / x${d.opponentEffectiveness} · ` +
      `speed ${Math.round(d.mySpeed)} / ${Math.round(d.opponentSpeed)} · ` +
      `rate ${d.myRate.toFixed(4)} / ${d.opponentRate.toFixed(4)} → ${faintedName} fainted ` +
      `(you lost ${hp(d.hpLostMine)} hp, they lost ${hp(d.hpLostOpponent)} hp)`
    )
  }

  const standing = trace.mine.filter((m) => m.hpLeft > 0)
  const remaining = trace.opponents.filter((o) => o.hpLeft > 0)
  const verdict = outcome.won
    ? `All opponents fainted. Standing: ${standing.map((m) => `${name(m.id)} ${hp(m.hpLeft)}`).join(', ')} ` +
      `(sum ${hp(standing.reduce((s, m) => s + m.hpLeft, 0))} = margin)`
    : `All your Pokémon fainted. Opponents left: ${remaining.map((o) => `${name(o.id)} ${hp(o.hpLeft)}`).join(', ')} ` +
      `(sum ${hp(remaining.reduce((s, o) => s + o.hpLeft, 0))} = -margin)`

  return {
    title,
    lines: [
      `Opponents (stats scaled to avg BST ${Math.round(trace.targetBst)}): ` +
        trace.opponents.map((o) => `${name(o.id)} (${Math.round(o.scaledBst)})`).join(', '),
      ...trace.duels.map(duel),
      verdict,
      RULE,
    ],
  }
}

/** The battle log is for debugging: it only prints when the page URL has a `debug` parameter (`/?debug`). */
export const isDebugLogging = (search: string): boolean => new URLSearchParams(search).has('debug')

/** Prints the record, one collapsed group per fight explaining its result, and a summary table. */
export function logBattles(
  result: SimulationResult,
  gauntlet: readonly GauntletFight[],
  byId: ReadonlyMap<number, PokemonEntry>,
  out: Sink = console,
): void {
  const fightById = new Map(gauntlet.map((f) => [f.id, f]))
  out.log(`[45-0] record ${result.wins}-${result.losses}`)
  const rows = result.fights.map((o) => {
    const fight = fightById.get(o.fightId)!
    const { title, lines } = describeFight(fight, o, byId)
    out.groupCollapsed(title)
    for (const line of lines) out.log(line)
    out.groupEnd()
    return {
      fight: fight.name,
      gen: fight.gen,
      tier: fight.tier,
      result: o.won ? 'won' : 'lost',
      margin: Number(o.margin.toFixed(3)),
      winProb: Number(o.winProb.toFixed(3)),
      duels: o.trace.duels.length,
      mineStanding: o.trace.mine.filter((m) => m.hpLeft > 0).length,
      opponentsStanding: o.trace.opponents.filter((p) => p.hpLeft > 0).length,
    }
  })
  out.table(rows)
}
