import type { Category, LegendKind } from '../../src/data/types.ts'
import type { FormInfo } from './forms.ts'

export interface CategoryOverrides {
  /** Box-art legends per the VGC restricted list, plus Arceus. Wins over every other flag. */
  restricted: ReadonlySet<string>
  /** Not flagged in PokeAPI. */
  paradox: ReadonlySet<string>
  /** Not flagged in PokeAPI. */
  ultraBeasts: ReadonlySet<string>
}

export interface Classification {
  category: Category
  /** Set for legend-class entries only. */
  legendKind?: LegendKind
}

/**
 * Megas are always `mega`. Otherwise legend-class Pokémon get a kind, in this priority order:
 * box art (the restricted list wins over every other flag), paradox, ultra beast, mythical, legendary.
 */
export function classifyCategory(
  input: { speciesSlug: string; isLegendary: boolean; isMythical: boolean; form: FormInfo },
  overrides: CategoryOverrides,
): Classification {
  const { speciesSlug, isLegendary, isMythical, form } = input
  if (form.kind === 'mega') return { category: 'mega' }
  const legend = (legendKind: LegendKind): Classification => ({ category: 'legend', legendKind })
  if (overrides.restricted.has(speciesSlug)) return legend('box-art')
  if (overrides.paradox.has(speciesSlug)) return legend('paradox')
  if (overrides.ultraBeasts.has(speciesSlug)) return legend('ultra-beast')
  if (isMythical) return legend('mythical')
  if (isLegendary) return legend('legendary')
  return { category: 'normal' }
}
