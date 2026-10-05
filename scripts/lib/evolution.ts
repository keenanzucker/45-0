import type { FormInfo } from './forms.ts'

export interface ChainNode {
  species: { name: string }
  evolves_to: ChainNode[]
}

/** Species that have no further evolution anywhere in the chain. */
export function finalSpeciesInChain(chain: ChainNode): Set<string> {
  const finals = new Set<string>()
  const walk = (node: ChainNode) => {
    if (node.evolves_to.length === 0) finals.add(node.species.name)
    node.evolves_to.forEach(walk)
  }
  walk(chain)
  return finals
}

/**
 * PokeAPI chains are per species, so a species whose evolution only exists for
 * a regional form (e.g. Mr. Mime -> Mr. Rime via Galarian Mr. Mime) looks
 * non-final even though the base form is. `baseFinalOverrides` corrects that
 * for default forms; regional forms always follow the chain.
 */
export function isFinalForm(opts: {
  speciesSlug: string
  form: FormInfo
  chainFinals: ReadonlySet<string>
  baseFinalOverrides: ReadonlySet<string>
}): boolean {
  const { speciesSlug, form, chainFinals, baseFinalOverrides } = opts
  switch (form.kind) {
    case 'mega':
      return true
    case 'regional':
    case 'alternate':
      return chainFinals.has(speciesSlug)
    case 'default':
      return chainFinals.has(speciesSlug) || baseFinalOverrides.has(speciesSlug)
  }
}
