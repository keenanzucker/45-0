import { describe, expect, it } from 'vitest'
import { classifyCategory, type CategoryOverrides } from './classify.ts'

const overrides: CategoryOverrides = {
  restricted: new Set(['mewtwo', 'arceus', 'koraidon', 'rayquaza']),
  paradox: new Set(['great-tusk', 'koraidon']),
  ultraBeasts: new Set(['nihilego']),
}

const classify = (
  speciesSlug: string,
  flags: { isLegendary?: boolean; isMythical?: boolean; kind?: 'default' | 'mega' | 'alternate'; primal?: boolean } = {},
) =>
  classifyCategory(
    {
      speciesSlug,
      isLegendary: flags.isLegendary ?? false,
      isMythical: flags.isMythical ?? false,
      form:
        flags.kind === 'mega'
          ? { kind: 'mega', primal: flags.primal }
          : { kind: flags.kind ?? 'default' },
    },
    overrides,
  )

describe('classifyCategory', () => {
  it('should classify megas as mega even when the species is a restricted legendary', () => {
    expect(classify('rayquaza', { isLegendary: true, kind: 'mega' })).toEqual({ category: 'mega' })
  })

  it('should classify primal forms as mega', () => {
    expect(classify('kyogre', { isLegendary: true, kind: 'mega', primal: true })).toEqual({ category: 'mega' })
  })

  it('should classify restricted legendaries as box art, including alternate forms', () => {
    expect(classify('mewtwo', { isLegendary: true })).toEqual({ category: 'legend', legendKind: 'box-art' })
    expect(classify('mewtwo', { isLegendary: true, kind: 'alternate' })).toEqual({ category: 'legend', legendKind: 'box-art' })
  })

  it('should classify Arceus as box art even though it is flagged mythical', () => {
    expect(classify('arceus', { isMythical: true })).toEqual({ category: 'legend', legendKind: 'box-art' })
  })

  it('should prefer box art over paradox for restricted paradox legends', () => {
    expect(classify('koraidon', { isLegendary: true })).toEqual({ category: 'legend', legendKind: 'box-art' })
  })

  it('should classify other legendaries as legendary', () => {
    expect(classify('articuno', { isLegendary: true })).toEqual({ category: 'legend', legendKind: 'legendary' })
    expect(classify('ogerpon', { isLegendary: true, kind: 'alternate' })).toEqual({ category: 'legend', legendKind: 'legendary' })
  })

  it('should classify mythicals as mythical', () => {
    expect(classify('mew', { isMythical: true })).toEqual({ category: 'legend', legendKind: 'mythical' })
  })

  it('should classify paradox Pokémon as paradox even without a PokeAPI flag', () => {
    expect(classify('great-tusk')).toEqual({ category: 'legend', legendKind: 'paradox' })
  })

  it('should classify Ultra Beasts as ultra beasts even without a PokeAPI flag', () => {
    expect(classify('nihilego')).toEqual({ category: 'legend', legendKind: 'ultra-beast' })
  })

  it('should prefer paradox over the legendary and mythical flags', () => {
    expect(classify('great-tusk', { isLegendary: true })).toEqual({ category: 'legend', legendKind: 'paradox' })
    expect(classify('great-tusk', { isMythical: true })).toEqual({ category: 'legend', legendKind: 'paradox' })
  })

  it('should prefer ultra beast over the legendary and mythical flags', () => {
    expect(classify('nihilego', { isLegendary: true })).toEqual({ category: 'legend', legendKind: 'ultra-beast' })
    expect(classify('nihilego', { isMythical: true })).toEqual({ category: 'legend', legendKind: 'ultra-beast' })
  })

  it('should leave ordinary Pokémon normal with no legend kind', () => {
    expect(classify('pikachu')).toEqual({ category: 'normal' })
  })
})
