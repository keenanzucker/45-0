import type { Category, Gen, PokemonEntry, PokemonType } from '../data/types.ts'

/** Minimal PokemonEntry for tests. */
export const mkEntry = (
  id: number,
  gen: Gen,
  types: PokemonType[],
  over: Partial<PokemonEntry> & { category?: Category } = {},
): PokemonEntry => ({
  id,
  slug: `p${id}`,
  name: `P${id}`,
  speciesId: id,
  gen,
  types,
  stats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
  bst: 300,
  category: 'normal',
  isStarter: false,
  isFinal: true,
  sprite: `/sprites/${id}.png`,
  ...over,
})

/** `count` normal entries for every (gen, type) pair given, with sequential ids from `startId`. */
export const gridEntries = (
  gens: Gen[],
  types: PokemonType[],
  count: number,
  startId = 1,
): PokemonEntry[] => {
  const out: PokemonEntry[] = []
  let id = startId
  for (const gen of gens) for (const type of types) {
    for (let i = 0; i < count; i++) out.push(mkEntry(id++, gen, [type]))
  }
  return out
}
