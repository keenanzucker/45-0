import type { FightTier, Gen, GauntletFight, PokemonEntry } from '../../src/data/types.ts'
import { resolveDittoBaseMon, resolvePokemonDbMon, sameTeam } from './resolve.ts'
import type { ParsedTrainer } from './trainers.ts'

export interface FightConfig {
  id: string
  name: string
  tier: FightTier
  /** Locates the trainer on PokémonDB: section id prefix (e.g. "elite4") plus trainer name. */
  pdb?: { section: string; name: string }
  /** Locates the trainer on DittoBase by npc card id. */
  ditto?: { id: string }
  /** Substring (case-insensitive) selecting one of several teams per source. */
  variant?: { pdb?: string; ditto?: string }
}

export interface FightContext {
  gen: Gen
  region: string
  game: string
}

export type FightStatus = 'both-agree' | 'conflict' | 'single-source' | 'manual'

export interface BuiltFight {
  fight: GauntletFight
  status: FightStatus
  notes: string[]
}

const MAX_TEAM = 6

function pickTrainer(
  cfgId: string,
  source: string,
  candidates: ParsedTrainer[],
  variantHint: string | undefined,
): ParsedTrainer {
  if (candidates.length === 0) throw new Error(`${cfgId}: trainer not found in ${source}`)
  if (!variantHint) return candidates[0]
  const hint = variantHint.toLowerCase()
  const found = candidates.find((c) => c.variant?.toLowerCase().includes(hint))
  if (!found) throw new Error(`${cfgId}: no ${source} team with variant "${variantHint}"`)
  return found
}

const multisetDiff = (a: string[], b: string[]) => {
  const rest = [...b]
  return a.filter((x) => {
    const i = rest.indexOf(x)
    if (i === -1) return true
    rest.splice(i, 1)
    return false
  })
}

export function buildFight(
  cfg: FightConfig,
  ctx: FightContext,
  pdbTrainers: ParsedTrainer[],
  dittoTrainers: ParsedTrainer[],
  pool: readonly PokemonEntry[],
  fixes: Record<string, string[]>,
): BuiltFight {
  const base = {
    id: cfg.id,
    gen: ctx.gen,
    region: ctx.region,
    name: cfg.name,
    tier: cfg.tier,
    game: ctx.game,
  }
  const finish = (team: number[], variant: string | undefined, status: FightStatus, notes: string[]) => {
    if (team.length < 1 || team.length > MAX_TEAM) {
      throw new Error(`${cfg.id}: invalid team size ${team.length}`)
    }
    const fight: GauntletFight = { ...base, ...(variant ? { variant } : {}), team }
    return { fight, status, notes }
  }

  const fix = fixes[cfg.id]
  if (fix) {
    const team = fix.map((slug) => {
      const entry = pool.find((e) => e.slug === slug)
      if (!entry) throw new Error(`${cfg.id}: fix names unknown slug "${slug}"`)
      return entry.id
    })
    return finish(team, undefined, 'manual', ['manual fix applied'])
  }

  const pdb = cfg.pdb
    ? pickTrainer(
        cfg.id,
        'PokémonDB',
        pdbTrainers.filter(
          (t) =>
            t.id.startsWith(cfg.pdb!.section) &&
            t.name.toLowerCase() === cfg.pdb!.name.toLowerCase(),
        ),
        cfg.variant?.pdb,
      )
    : undefined
  const ditto = cfg.ditto
    ? pickTrainer(
        cfg.id,
        'DittoBase',
        dittoTrainers.filter((t) => t.id === cfg.ditto!.id),
        cfg.variant?.ditto,
      )
    : undefined

  const pdbTeam = pdb?.team.map((m) => resolvePokemonDbMon(m, pool).id)
  const dittoTeam = ditto?.team.map((m) => resolveDittoBaseMon(m, pool).id)
  const variant = pdb?.variant ?? ditto?.variant
  const slugs = (ids: number[]) => ids.map((id) => pool.find((e) => e.id === id)!.slug)

  if (pdbTeam && dittoTeam) {
    if (sameTeam(pdbTeam, dittoTeam)) return finish(pdbTeam, variant, 'both-agree', [])
    const [p, d] = [slugs(pdbTeam), slugs(dittoTeam)]
    return finish(pdbTeam, variant, 'conflict', [
      `only in PokémonDB: ${multisetDiff(p, d).join(', ') || '-'}`,
      `only in DittoBase: ${multisetDiff(d, p).join(', ') || '-'}`,
    ])
  }
  const only = (pdbTeam ?? dittoTeam)!
  return finish(only, variant, 'single-source', [`only ${pdbTeam ? 'PokémonDB' : 'DittoBase'} configured`])
}
