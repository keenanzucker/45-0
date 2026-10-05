/** Trainer-ladder rank by wins out of 45; thresholds are retuned against scripts/calibrate.ts. */
const TITLES: readonly { min: number; title: string; sprite: string; emoji: string }[] = [
  { min: 45, title: 'Pokémon Master', sprite: '/trainers/pokemon-master.png', emoji: '👑' },
  { min: 40, title: 'Champion', sprite: '/trainers/champion.png', emoji: '🏆' },
  { min: 33, title: 'Elite Four', sprite: '/trainers/elite-four.png', emoji: '🥇' },
  { min: 25, title: 'Gym Leader', sprite: '/trainers/gym-leader.png', emoji: '🏅' },
  { min: 15, title: 'Ace Trainer', sprite: '/trainers/ace-trainer.png', emoji: '⭐' },
  { min: 0, title: 'Youngster', sprite: '/trainers/youngster.png', emoji: '🎒' },
]

const rankFor = (wins: number) => TITLES.find((t) => wins >= t.min) ?? TITLES[TITLES.length - 1]

export const titleForWins = (wins: number): string => rankFor(wins).title

/** The trainer portrait that goes with the title earned at `wins`. */
export const trainerSpriteForWins = (wins: number): string => rankFor(wins).sprite

/** The emoji that goes with the title earned at `wins`, used in the share text. */
export const emojiForWins = (wins: number): string => rankFor(wins).emoji

/** Every rank with its trainer portrait, highest first. */
export const RANKS: readonly { title: string; sprite: string }[] = TITLES.map(({ title, sprite }) => ({ title, sprite }))
