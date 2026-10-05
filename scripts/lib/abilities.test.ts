import { describe, expect, it } from 'vitest'
import { guaranteedImmunities, IMMUNITY_ABILITIES } from './abilities.ts'

const abilities = (...names: string[]) => names.map((name, i) => ({ ability: { name }, is_hidden: i > 0 && name.endsWith('*'), slot: i + 1 }))

describe('guaranteedImmunities', () => {
  it('should grant the immunity of a Pokémon whose only ability is one', () => {
    expect(guaranteedImmunities(abilities('levitate'))).toEqual(['ground'])
    expect(guaranteedImmunities(abilities('volt-absorb'))).toEqual(['electric'])
  })

  it('should grant it when every ability, hidden ones included, gives the same immunity', () => {
    expect(guaranteedImmunities(abilities('volt-absorb', 'lightning-rod'))).toEqual(['electric'])
    expect(guaranteedImmunities(abilities('levitate', 'earth-eater'))).toEqual(['ground'])
  })

  it('should grant nothing when the Pokémon can have an ability without the immunity', () => {
    expect(guaranteedImmunities(abilities('levitate', 'neutralizing-gas', 'stench'))).toEqual([])
    expect(guaranteedImmunities(abilities('static', 'lightning-rod'))).toEqual([])
  })

  it('should grant nothing when the abilities give different immunities', () => {
    expect(guaranteedImmunities(abilities('volt-absorb', 'water-absorb'))).toEqual([])
  })

  it('should grant nothing for abilities that are not full type immunities', () => {
    expect(guaranteedImmunities(abilities('thick-fat'))).toEqual([])
    expect(guaranteedImmunities(abilities('intimidate', 'flash-fire'))).toEqual([])
    expect(guaranteedImmunities([])).toEqual([])
  })

  it('should cover exactly the full type-immunity abilities', () => {
    expect(IMMUNITY_ABILITIES).toEqual({
      levitate: 'ground',
      'earth-eater': 'ground',
      'flash-fire': 'fire',
      'well-baked-body': 'fire',
      'water-absorb': 'water',
      'storm-drain': 'water',
      'dry-skin': 'water',
      'volt-absorb': 'electric',
      'lightning-rod': 'electric',
      'motor-drive': 'electric',
      'sap-sipper': 'grass',
    })
  })
})
