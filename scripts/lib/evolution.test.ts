import { describe, expect, it } from 'vitest'
import { finalSpeciesInChain, isFinalForm, type ChainNode } from './evolution.ts'

const node = (name: string, evolves_to: ChainNode[] = []): ChainNode => ({
  species: { name },
  evolves_to,
})

describe('finalSpeciesInChain', () => {
  it('should return the species itself for a single-stage chain', () => {
    expect(finalSpeciesInChain(node('tauros'))).toEqual(new Set(['tauros']))
  })

  it('should return only the last stage of a linear chain', () => {
    const chain = node('charmander', [node('charmeleon', [node('charizard')])])
    expect(finalSpeciesInChain(chain)).toEqual(new Set(['charizard']))
  })

  it('should return every leaf of a branching chain', () => {
    const chain = node('eevee', [node('vaporeon'), node('jolteon'), node('flareon')])
    expect(finalSpeciesInChain(chain)).toEqual(new Set(['vaporeon', 'jolteon', 'flareon']))
  })
})

describe('isFinalForm', () => {
  const chainFinals = new Set(['charizard', 'persian'])
  const baseFinalOverrides = new Set(['mr-mime'])
  const check = (speciesSlug: string, form: Parameters<typeof isFinalForm>[0]['form']) =>
    isFinalForm({ speciesSlug, form, chainFinals, baseFinalOverrides })

  it('should treat default forms of final species as final', () => {
    expect(check('charizard', { kind: 'default' })).toBe(true)
  })

  it('should treat default forms of non-final species as not final', () => {
    expect(check('charmeleon', { kind: 'default' })).toBe(false)
  })

  it('should let overrides mark a base form final when only a regional form evolves', () => {
    expect(check('mr-mime', { kind: 'default' })).toBe(true)
  })

  it('should not apply base overrides to regional forms', () => {
    expect(check('mr-mime', { kind: 'regional', region: 'galar' })).toBe(false)
  })

  it('should follow the species chain for regional forms', () => {
    expect(check('persian', { kind: 'regional', region: 'alola' })).toBe(true)
    expect(check('meowth', { kind: 'regional', region: 'alola' })).toBe(false)
  })

  it('should follow the species chain for alternate forms', () => {
    expect(check('persian', { kind: 'alternate' })).toBe(true)
    expect(check('meowth', { kind: 'alternate' })).toBe(false)
  })

  it('should treat megas as always final', () => {
    expect(check('charizard', { kind: 'mega' })).toBe(true)
  })
})
