// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Category, LegendKind } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import { mkEntry } from '../engine/testUtils.ts'
import { PickList } from './PickList.tsx'

afterEach(cleanup)

const variants: { category: Category; legendKind?: LegendKind }[] = [
  { category: 'normal' },
  { category: 'legend', legendKind: 'box-art' },
  { category: 'legend', legendKind: 'legendary' },
  { category: 'legend', legendKind: 'mythical' },
  { category: 'legend', legendKind: 'paradox' },
  { category: 'legend', legendKind: 'ultra-beast' },
  { category: 'mega' },
]
const entries = variants.map((v, i) => mkEntry(i + 1, 1, ['fire'], { name: `Mon${i + 1}`, ...v }))
const byId = new Map(entries.map((e) => [e.id, e]))

const renderList = (mode: Mode) =>
  render(
    <PickList
      rows={entries.map((entry) => ({ entry, selectable: true }))}
      mode={mode}
      sort="bst"
      filter="all"
      selectedId={null}
      roster={[null, null, null, null, null, null]}
      byId={byId}
      onSort={() => {}}
      onFilter={() => {}}
      onSelect={() => {}}
    />,
  )

const tags = (container: HTMLElement) => [...container.querySelectorAll('.tag')].map((t) => t.textContent)

describe('PickList in hard mode', () => {
  it('should tag every legend-class Pokémon just LEGEND, and Megas MEGA, so those slots can be filled', () => {
    const { container } = renderList('hard')
    expect(tags(container)).toEqual(['LEGEND', 'LEGEND', 'LEGEND', 'LEGEND', 'LEGEND', 'MEGA'])
  })

  it('should keep types and stats hidden', () => {
    const { container } = renderList('hard')
    expect(container.querySelector('.pick .type')).toBeNull()
    expect(container.querySelector('.pick__bst')).toBeNull()
    expect(container.querySelector('.bars')).toBeNull()
  })

  it('should lay the options out in a single column', () => {
    const { container } = renderList('hard')
    expect(container.querySelector('.picklist')!.className).toBe('picklist')
  })
})

describe('PickList in normal mode', () => {
  it('should tag each legend-class Pokémon with its kind, and Megas MEGA', () => {
    const { container } = renderList('normal')
    expect(tags(container)).toEqual(['BOX ART', 'LEGENDARY', 'MYTHICAL', 'PARADOX', 'ULTRA BEAST', 'MEGA'])
  })

  it('should style each kind of tag separately', () => {
    const { container } = renderList('normal')
    const classes = [...container.querySelectorAll('.tag')].map((t) => t.className)
    expect(new Set(classes).size).toBe(6)
  })

  it('should offer All, Normal, Legend and Mega filters', () => {
    const { container } = renderList('normal')
    const chips = [...container.querySelectorAll('[aria-label="Filter by slot type"] .chip')].map((c) => c.textContent)
    expect(chips).toEqual(['All', 'Normal', 'Legend', 'Mega'])
  })
})
