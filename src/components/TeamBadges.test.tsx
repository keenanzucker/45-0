// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mkEntry } from '../engine/testUtils.ts'
import { TeamBadges } from './TeamBadges.tsx'

afterEach(cleanup)

const monoFire = Array.from({ length: 6 }, (_, i) => mkEntry(i + 1, 3, ['fire'], { category: 'normal' }))

describe('TeamBadges', () => {
  it('should show a chip with emoji and label for each badge the team earns', () => {
    render(<TeamBadges team={monoFire} wins={30} />)
    const list = screen.getByRole('list', { name: 'Team badges' })
    const chips = [...list.querySelectorAll('li')].map((li) => li.textContent)
    expect(chips).toEqual(['🔥Mono-type', '🗺️One-region team', '🚫No legends'])
  })

  it('should explain a badge in its tooltip', () => {
    render(<TeamBadges team={monoFire} wins={30} />)
    expect(screen.getByText('Mono-type').closest('li')!.getAttribute('title')).toBe('All six share a type')
  })

  it('should render nothing when the team earns no badges', () => {
    const gens = [1, 1, 2, 2, 3, 3] as const
    const plain = gens.map((gen, i) =>
      mkEntry(i + 1, gen, i === 0 ? ['fire'] : ['water'], { category: i === 0 ? 'legend' : 'normal' }),
    )
    const { container } = render(<TeamBadges team={plain} wins={10} />)
    expect(container.querySelector('.badges')).toBeNull()
  })
})
