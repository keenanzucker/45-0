import { describe, expect, it } from 'vitest'
import { emojiForWins, titleForWins, trainerSpriteForWins } from './titles.ts'

describe('titleForWins', () => {
  it.each([
    [0, 'Youngster'],
    [14, 'Youngster'],
    [15, 'Ace Trainer'],
    [24, 'Ace Trainer'],
    [25, 'Gym Leader'],
    [32, 'Gym Leader'],
    [33, 'Elite Four'],
    [39, 'Elite Four'],
    [40, 'Champion'],
    [44, 'Champion'],
    [45, 'Pokémon Master'],
  ])('should title %i wins as %s', (wins, title) => {
    expect(titleForWins(wins)).toBe(title)
  })
})

describe('trainerSpriteForWins', () => {
  it.each([
    [0, '/trainers/youngster.png'],
    [15, '/trainers/ace-trainer.png'],
    [25, '/trainers/gym-leader.png'],
    [33, '/trainers/elite-four.png'],
    [40, '/trainers/champion.png'],
    [45, '/trainers/pokemon-master.png'],
  ])('should show the trainer for the rank reached at %i wins', (wins, sprite) => {
    expect(trainerSpriteForWins(wins)).toBe(sprite)
  })

  it('should switch trainer at exactly the same wins as the title', () => {
    for (let wins = 1; wins <= 45; wins++) {
      const changedTitle = titleForWins(wins) !== titleForWins(wins - 1)
      expect(trainerSpriteForWins(wins) !== trainerSpriteForWins(wins - 1)).toBe(changedTitle)
    }
  })
})

describe('emojiForWins', () => {
  it.each([
    [0, '🎒'],
    [15, '⭐'],
    [25, '🏅'],
    [33, '🥇'],
    [40, '🏆'],
    [45, '👑'],
  ])('should give the emoji for the rank reached at %i wins', (wins, emoji) => {
    expect(emojiForWins(wins)).toBe(emoji)
  })

  it('should give every rank its own emoji', () => {
    const emojis = [0, 15, 25, 33, 40, 45].map(emojiForWins)
    expect(new Set(emojis).size).toBe(6)
  })
})
