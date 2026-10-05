import type { Gen } from '../src/data/types.ts'
import type { FightConfig } from './lib/gauntlet.ts'

export interface GenConfig {
  gen: Gen
  region: string
  /** Game slug shared by both sources (e.g. "red-blue"). */
  game: string
  /** PokémonDB page path when it isn't `<game>/gymleaders-elitefour`. */
  pdbPath?: string
  fights: FightConfig[]
}

const e4 = (
  gen: Gen,
  name: string,
  section: string,
  ditto: string,
  tier: FightConfig['tier'] = 'e4',
): FightConfig => ({
  id: `g${gen}-${name.toLowerCase()}`,
  name,
  tier,
  pdb: { section, name },
  ditto: { id: ditto },
})

export const GAUNTLET: GenConfig[] = [
  {
    gen: 1,
    region: 'Kanto',
    game: 'red-blue',
    fights: [
      e4(1, 'Lorelei', 'elite4', 'lorelei'),
      e4(1, 'Bruno', 'elite4', 'bruno'),
      e4(1, 'Agatha', 'elite4', 'agatha'),
      e4(1, 'Lance', 'elite4', 'lance'),
      { ...e4(1, 'Blue', 'champion', 'blue', 'champion'), variant: { pdb: 'bulbasaur', ditto: 'bulbasaur' } },
    ],
  },
  {
    gen: 2,
    region: 'Johto',
    game: 'gold-silver',
    fights: [
      e4(2, 'Will', 'elite4', 'will'),
      e4(2, 'Koga', 'elite4', 'koga'),
      e4(2, 'Bruno', 'elite4', 'bruno'),
      e4(2, 'Karen', 'elite4', 'karen'),
      e4(2, 'Lance', 'champion', 'lance', 'champion'),
    ],
  },
  {
    gen: 3,
    region: 'Hoenn',
    game: 'ruby-sapphire',
    fights: [
      e4(3, 'Sidney', 'elite4', 'sidney'),
      e4(3, 'Phoebe', 'elite4', 'phoebe'),
      e4(3, 'Glacia', 'elite4', 'glacia'),
      e4(3, 'Drake', 'elite4', 'drake'),
      e4(3, 'Steven', 'champion', 'steven', 'champion'),
    ],
  },
  {
    gen: 4,
    region: 'Sinnoh',
    game: 'platinum',
    fights: [
      e4(4, 'Aaron', 'elite4', 'aaron'),
      e4(4, 'Bertha', 'elite4', 'bertha'),
      e4(4, 'Flint', 'elite4', 'flint'),
      e4(4, 'Lucian', 'elite4', 'lucian'),
      e4(4, 'Cynthia', 'champion', 'cynthia', 'champion'),
    ],
  },
  {
    gen: 5,
    region: 'Unova',
    game: 'black-white',
    fights: [
      e4(5, 'Shauntal', 'elite4', 'shauntal'),
      e4(5, 'Grimsley', 'elite4', 'grimsley'),
      e4(5, 'Caitlin', 'elite4', 'caitlin'),
      e4(5, 'Marshal', 'elite4', 'marshal'),
      e4(5, 'Alder', 'champion', 'alder', 'champion'),
    ],
  },
  {
    gen: 6,
    region: 'Kalos',
    game: 'x-y',
    fights: [
      e4(6, 'Wikstrom', 'elite4', 'wikstrom'),
      e4(6, 'Malva', 'elite4', 'malva'),
      e4(6, 'Drasna', 'elite4', 'drasna'),
      e4(6, 'Siebold', 'elite4', 'siebold'),
      e4(6, 'Diantha', 'champion', 'diantha', 'champion'),
    ],
  },
  {
    gen: 7,
    region: 'Alola',
    game: 'sun-moon',
    pdbPath: 'sun-moon/kahunas-elitefour',
    fights: [
      e4(7, 'Hala', 'elite4', 'hala-elite-four'),
      e4(7, 'Olivia', 'elite4', 'olivia-elite-four'),
      e4(7, 'Acerola', 'elite4', 'acerola-elite-four'),
      e4(7, 'Kahili', 'elite4', 'kahili'),
      e4(7, 'Kukui', 'champion', 'kukui', 'champion'),
    ],
  },
  {
    gen: 8,
    region: 'Galar',
    game: 'sword-shield',
    pdbPath: 'sword-shield/gymleaders',
    fights: [
      e4(8, 'Opal', 'gym', 'opal', 'gym'),
      e4(8, 'Gordie', 'gym', 'gordie', 'gym'),
      e4(8, 'Piers', 'gym', 'piers', 'gym'),
      e4(8, 'Raihan', 'gym', 'raihan', 'gym'),
      // PokémonDB has no Champion Cup page, so Leon is DittoBase-only (manually
      // confirmed against Serebii's Champion Cup page).
      { id: 'g8-leon', name: 'Leon', tier: 'champion', ditto: { id: 'leon' } },
    ],
  },
  {
    gen: 9,
    region: 'Paldea',
    game: 'scarlet-violet',
    fights: [
      e4(9, 'Rika', 'elite4', 'rika'),
      e4(9, 'Poppy', 'elite4', 'poppy'),
      e4(9, 'Larry', 'elite4', 'larry-elite-four'),
      e4(9, 'Hassel', 'elite4', 'hassel'),
      e4(9, 'Geeta', 'champion', 'geeta', 'champion'),
    ],
  },
]
