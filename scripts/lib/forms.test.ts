import { describe, expect, it } from 'vitest'
import { mkEntry } from '../../src/engine/testUtils.ts'
import { classifyForm, formDisplayName, formGen, plainSoleMegaNames, unknownIncludes } from './forms.ts'

const ALTERNATES = [
  'ogerpon-wellspring-mask',
  'kyurem-black',
  'dialga-origin',
  'rotom-heat',
  'oricorio-pom-pom',
]

describe('classifyForm', () => {
  it('should classify the species default variety as default when is_default is true', () => {
    expect(classifyForm('charizard', true)).toEqual({ kind: 'default' })
  })

  it.each([
    'charizard-mega-x',
    'charizard-mega-y',
    'clefable-mega',
    'absol-mega-z',
  ])('should classify %s as mega', (slug) => {
    expect(classifyForm(slug, false)).toEqual({ kind: 'mega' })
  })

  it.each([
    ['vulpix-alola', 'alola'],
    ['meowth-galar', 'galar'],
    ['typhlosion-hisui', 'hisui'],
    ['wooper-paldea', 'paldea'],
    ['tauros-paldea-combat-breed', 'paldea'],
    ['darmanitan-galar-standard', 'galar'],
    ['mr-mime-galar', 'galar'],
  ])('should classify %s as a %s regional form', (slug, region) => {
    expect(classifyForm(slug, false)).toEqual({ kind: 'regional', region })
  })

  it.each([
    'pikachu-alola-cap',
    'charizard-gmax',
    'darmanitan-galar-zen',
    'deoxys-attack',
    'rotom-wash',
    'eternatus-eternamax',
    'raticate-totem-alola',
  ])('should exclude %s', (slug) => {
    expect(classifyForm(slug, false)).toBeNull()
  })
})

describe('classifyForm alternates and primals', () => {
  const include = new Set(['ogerpon-wellspring-mask', 'kyurem-black'])

  it('should classify explicitly included alternate forms as alternate', () => {
    expect(classifyForm('ogerpon-wellspring-mask', false, include)).toEqual({ kind: 'alternate' })
    expect(classifyForm('kyurem-black', false, include)).toEqual({ kind: 'alternate' })
  })

  it('should exclude alternate forms that are not in the include list', () => {
    expect(classifyForm('ogerpon-hearthflame-mask', false, include)).toBeNull()
    expect(classifyForm('ogerpon-wellspring-mask', false)).toBeNull()
  })

  it('should still exclude totem forms even if listed', () => {
    expect(classifyForm('marowak-totem', false, new Set(['marowak-totem']))).toBeNull()
  })

  it.each(['kyogre-primal', 'groudon-primal'])('should classify %s as a primal mega', (slug) => {
    expect(classifyForm(slug, false)).toEqual({ kind: 'mega', primal: true })
  })
})

describe('unknownIncludes', () => {
  it('should return include entries that match no available slug', () => {
    expect(unknownIncludes(new Set(['a', 'b', 'c']), new Set(['a', 'c']))).toEqual(['b'])
  })

  it('should return nothing when every entry exists', () => {
    expect(unknownIncludes(new Set(['a']), new Set(['a', 'b']))).toEqual([])
  })
})

describe('formDisplayName', () => {
  const name = (speciesName: string, speciesSlug: string, slug: string, isDefault = false) => {
    const form = classifyForm(slug, isDefault, new Set(ALTERNATES))
    if (!form) throw new Error(`fixture ${slug} not classified`)
    return formDisplayName(speciesName, speciesSlug, slug, form)
  }

  it('should use the species name for default varieties', () => {
    expect(name('Charizard', 'charizard', 'charizard', true)).toBe('Charizard')
  })

  it('should prefix Mega and suffix the letter for X/Y/Z megas', () => {
    expect(name('Charizard', 'charizard', 'charizard-mega-x')).toBe('Mega Charizard X')
    expect(name('Absol', 'absol', 'absol-mega-z')).toBe('Mega Absol Z')
  })

  it('should show a form word before -mega in parentheses instead of a letter', () => {
    expect(name('Meowstic', 'meowstic', 'meowstic-female-mega')).toBe('Mega Meowstic (Female)')
    expect(name('Tatsugiri', 'tatsugiri', 'tatsugiri-curly-mega')).toBe('Mega Tatsugiri (Curly)')
    expect(name('Magearna', 'magearna', 'magearna-original-mega')).toBe('Mega Magearna (Original)')
  })

  it('should prefix Mega without a suffix for single megas', () => {
    expect(name('Clefable', 'clefable', 'clefable-mega')).toBe('Mega Clefable')
  })

  it.each([
    ['Vulpix', 'vulpix', 'vulpix-alola', 'Alolan Vulpix'],
    ['Meowth', 'meowth', 'meowth-galar', 'Galarian Meowth'],
    ['Typhlosion', 'typhlosion', 'typhlosion-hisui', 'Hisuian Typhlosion'],
    ['Wooper', 'wooper', 'wooper-paldea', 'Paldean Wooper'],
    ['Mr. Mime', 'mr-mime', 'mr-mime-galar', 'Galarian Mr. Mime'],
    ['Darmanitan', 'darmanitan', 'darmanitan-galar-standard', 'Galarian Darmanitan'],
  ])('should name regional forms of %s as expected', (speciesName, speciesSlug, slug, expected) => {
    expect(name(speciesName, speciesSlug, slug)).toBe(expected)
  })

  it('should put the form in parentheses for alternate forms', () => {
    expect(name('Ogerpon', 'ogerpon', 'ogerpon-wellspring-mask')).toBe('Ogerpon (Wellspring Mask)')
    expect(name('Kyurem', 'kyurem', 'kyurem-black')).toBe('Kyurem (Black)')
    expect(name('Dialga', 'dialga', 'dialga-origin')).toBe('Dialga (Origin)')
    expect(name('Rotom', 'rotom', 'rotom-heat')).toBe('Rotom (Heat)')
    expect(name('Oricorio', 'oricorio', 'oricorio-pom-pom')).toBe('Oricorio (Pom Pom)')
  })

  it('should prefix Primal for primal forms', () => {
    expect(name('Kyogre', 'kyogre', 'kyogre-primal')).toBe('Primal Kyogre')
  })

  it('should append the breed in parentheses for Paldean Tauros', () => {
    expect(name('Tauros', 'tauros', 'tauros-paldea-combat-breed')).toBe(
      'Paldean Tauros (Combat Breed)',
    )
  })
})

describe('formGen', () => {
  it('should use the species generation for default forms and megas', () => {
    expect(formGen(1, { kind: 'default' })).toBe(1)
    expect(formGen(1, { kind: 'mega' })).toBe(1)
    expect(formGen(5, { kind: 'alternate' })).toBe(5)
  })

  it.each([
    ['alola', 7],
    ['galar', 8],
    ['hisui', 8],
    ['paldea', 9],
  ] as const)('should map the %s region to generation %i', (region, gen) => {
    expect(formGen(1, { kind: 'regional', region })).toBe(gen)
  })
})

describe('classifyForm exclusions', () => {
  const excluded = new Set(['magearna-original-mega'])

  it('should drop an excluded Mega even though Megas are otherwise included automatically', () => {
    expect(classifyForm('magearna-original-mega', false, new Set(), excluded)).toBeNull()
    expect(classifyForm('magearna-mega', false, new Set(), excluded)).toEqual({ kind: 'mega' })
  })

  it('should let an exclusion win over the include list', () => {
    expect(classifyForm('rotom-heat', false, new Set(['rotom-heat']), new Set(['rotom-heat']))).toBeNull()
  })

  it('should never drop a default form', () => {
    expect(classifyForm('magearna', true, new Set(), new Set(['magearna']))).toEqual({ kind: 'default' })
  })
})

describe('plainSoleMegaNames', () => {
  const mega = (id: number, speciesId: number, name: string) => ({
    ...mkEntry(id, 1, ['fire'], { name, category: 'mega' }),
    speciesId,
  })
  const names = (entries: ReturnType<typeof mega>[]) => plainSoleMegaNames(entries).map((e) => e.name)

  it('should drop the form word from a Mega that is the only one of its species', () => {
    expect(names([mega(1, 978, 'Mega Tatsugiri (Curly)'), mega(2, 678, 'Mega Meowstic (Male)')])).toEqual([
      'Mega Tatsugiri',
      'Mega Meowstic',
    ])
  })

  it('should keep the form words when the species has several Megas', () => {
    const both = [mega(1, 678, 'Mega Meowstic (Male)'), mega(2, 678, 'Mega Meowstic (Female)')]
    expect(names(both)).toEqual(['Mega Meowstic (Male)', 'Mega Meowstic (Female)'])
  })

  it('should leave lettered, plain and non-Mega names alone', () => {
    const entries = [
      mega(1, 6, 'Mega Charizard X'),
      mega(2, 6, 'Mega Charizard Y'),
      mega(3, 36, 'Mega Clefable'),
      { ...mkEntry(4, 1, ['fire'], { name: 'Zacian (Crowned)' }), speciesId: 888 },
    ]
    expect(names(entries as ReturnType<typeof mega>[])).toEqual([
      'Mega Charizard X',
      'Mega Charizard Y',
      'Mega Clefable',
      'Zacian (Crowned)',
    ])
  })

  it('should not change slugs or any other field', () => {
    const [before] = [mega(1, 978, 'Mega Tatsugiri (Curly)')]
    const [after] = plainSoleMegaNames([before])
    expect({ ...after, name: before.name }).toEqual(before)
  })
})
