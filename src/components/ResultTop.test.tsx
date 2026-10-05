// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkEntry } from '../engine/testUtils.ts'
import { ResultTop } from './ResultTop.tsx'

// jsdom has no AnimationEvent, so React would listen for the webkit-prefixed event names.
vi.hoisted(() => {
  globalThis.AnimationEvent ??= class AnimationEvent extends Event {} as unknown as typeof globalThis.AnimationEvent
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const team = Array.from({ length: 6 }, (_, i) => mkEntry(i + 1, 1, ['fire']))
const renderTop = (wins: number) => render(<ResultTop team={team} wins={wins} losses={45 - wins} mode="normal" />)
const sprites = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.hof__sprite')]

describe('ResultTop sprites', () => {
  it('should hop a sprite when it is tapped', () => {
    const { container } = renderTop(30)
    fireEvent.click(sprites(container)[2])
    expect(sprites(container)[2].classList.contains('hof__sprite--hop')).toBe(true)
    expect(sprites(container)[1].classList.contains('hof__sprite--hop')).toBe(false)
  })

  it('should stop hopping once the hop animation ends', () => {
    const { container } = renderTop(30)
    fireEvent.click(sprites(container)[0])
    fireEvent.animationEnd(sprites(container)[0])
    expect(sprites(container)[0].classList.contains('hof__sprite--hop')).toBe(false)
  })

  it('should ignore the end of the idle bob on the sprite itself', () => {
    const { container } = renderTop(30)
    fireEvent.click(sprites(container)[0])
    fireEvent.animationEnd(sprites(container)[0].querySelector('img')!)
    expect(sprites(container)[0].classList.contains('hof__sprite--hop')).toBe(true)
  })

  it('should spin a sprite on every tenth tap', () => {
    const { container } = renderTop(30)
    const tap = () => {
      fireEvent.click(sprites(container)[0])
      const classes = sprites(container)[0].className
      fireEvent.animationEnd(sprites(container)[0])
      return classes
    }
    const classes = Array.from({ length: 10 }, tap)
    expect(classes.slice(0, 9).every((c) => c.includes('hof__sprite--hop'))).toBe(true)
    expect(classes[9]).toContain('hof__sprite--spin')
    expect(classes[9]).not.toContain('hof__sprite--hop')
  })

  it('should stay still when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { container } = renderTop(30)
    fireEvent.click(sprites(container)[0])
    expect(sprites(container)[0].className).toBe('hof__sprite')
  })
})

describe('ResultTop perfect run', () => {
  it('should celebrate a 45–0 run with confetti, crowns and a gold record', () => {
    const { container } = renderTop(45)
    const confetti = container.querySelector('.confetti')!
    expect(confetti.getAttribute('aria-hidden')).toBe('true')
    expect(confetti.children.length).toBeGreaterThanOrEqual(20)
    expect(container.querySelectorAll('.hof__crown')).toHaveLength(6)
    expect(container.querySelector('.result__record')!.classList.contains('result__record--gold')).toBe(true)
  })

  it('should not celebrate a run with any loss', () => {
    const { container } = renderTop(44)
    expect(container.querySelector('.confetti')).toBeNull()
    expect(container.querySelector('.hof__crown')).toBeNull()
    expect(container.querySelector('.result__record--gold')).toBeNull()
  })
})
