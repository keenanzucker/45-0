// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkEntry } from '../engine/testUtils.ts'
import { AnimatedLogo, FallingSprites } from './HeroArt.tsx'

// jsdom has no AnimationEvent, so React would listen for the webkit-prefixed event names.
vi.hoisted(() => {
  globalThis.AnimationEvent ??= class AnimationEvent extends Event {} as unknown as typeof globalThis.AnimationEvent
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const entries = Array.from({ length: 20 }, (_, i) => mkEntry(i + 1, 1, ['fire']))

describe('FallingSprites', () => {
  it('should draw a decorative layer of sprites from the given Pokémon', () => {
    const { container } = render(<FallingSprites entries={entries} seed={5} count={14} />)
    const layer = container.querySelector('.fall')!
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    const imgs = [...layer.querySelectorAll('img')]
    expect(imgs).toHaveLength(14)
    for (const img of imgs) {
      expect(img.getAttribute('alt')).toBe('')
      expect(img.getAttribute('src')).toMatch(/^\/sprites\/\d+\.png$/)
    }
  })

  it('should swap a sprite for a new Pokémon when it starts falling again', () => {
    const { container } = render(<FallingSprites entries={entries} seed={5} count={14} />)
    const srcs = () => [...container.querySelectorAll('.fall img')].map((i) => i.getAttribute('src'))
    const before = srcs()
    const item = container.querySelectorAll('.fall__item')[3]
    fireEvent.animationIteration(item)
    const after = srcs()
    expect(after[3]).not.toBe(before[3])
    expect(after.filter((_, i) => i !== 3)).toEqual(before.filter((_, i) => i !== 3))
    expect(new Set(after).size).toBe(14)
  })

  it('should not swap when only the side-to-side sway of the sprite repeats', () => {
    const { container } = render(<FallingSprites entries={entries} seed={5} count={14} />)
    const before = [...container.querySelectorAll('.fall img')].map((i) => i.getAttribute('src'))
    fireEvent.animationIteration(container.querySelectorAll('.fall img')[3])
    expect([...container.querySelectorAll('.fall img')].map((i) => i.getAttribute('src'))).toEqual(before)
  })

  it('should keep every sprite when there are no other Pokémon to show', () => {
    const { container } = render(<FallingSprites entries={entries.slice(0, 3)} seed={5} count={14} />)
    const before = [...container.querySelectorAll('.fall img')].map((i) => i.getAttribute('src'))
    fireEvent.animationIteration(container.querySelectorAll('.fall__item')[0])
    expect([...container.querySelectorAll('.fall img')].map((i) => i.getAttribute('src'))).toEqual(before)
  })

  it('should draw nothing without Pokémon', () => {
    const { container } = render(<FallingSprites entries={[]} seed={5} count={14} />)
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })
})

describe('AnimatedLogo', () => {
  it('should be announced as 45-0 while the digits count up', () => {
    render(<AnimatedLogo />)
    expect(screen.getByRole('heading', { name: '45-0' })).toBeTruthy()
  })

  it('should count up to 45 and settle on 45-0', async () => {
    const { container } = render(<AnimatedLogo />)
    await waitFor(() => expect(container.querySelector('h1')!.textContent).toBe('45-0'), { timeout: 8000 })
  })

  it('should show 45-0 straight away when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { container } = render(<AnimatedLogo />)
    expect(container.querySelector('h1')!.textContent).toBe('45-0')
  })
})
