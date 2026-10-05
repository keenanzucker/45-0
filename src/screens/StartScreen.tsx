import { useState } from 'react'
import type { PokemonEntry } from '../data/types.ts'
import type { Mode } from '../engine/game.ts'
import { DsShell } from '../components/DsShell.tsx'
import { AnimatedLogo, FallingSprites } from '../components/HeroArt.tsx'

interface Props {
  /** Pokémon that can drift down the top screen. */
  entries: readonly PokemonEntry[]
  onStart(mode: Mode): void
  onRecords(): void
}

export function StartScreen({ entries, onStart, onRecords }: Props) {
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  return (
    <DsShell
      top={
        <div className="hero">
          <FallingSprites entries={entries} seed={seed} />
          <AnimatedLogo />
          <p className="hero__tag">Build an elite team of six to take on the <span className="nowrap">45-trainer</span> gauntlet.</p>
        </div>
      }
      bottom={
        <div className="menu">
          <button type="button" className="btn btn--primary" onClick={() => onStart('normal')}>
            NEW GAME
          </button>
          <button type="button" className="btn btn--hard" onClick={() => onStart('hard')}>
            🧠 HARD MODE
            <small>No stats, no types, A–Z list. Know your Pokémon.</small>
          </button>
          <button type="button" className="btn btn--tertiary" onClick={onRecords}>
            MY RECORDS
          </button>

          <details className="how">
            <summary>How to play</summary>
            <ol>
              <li>Each spin shows an <b>era</b> (Gen 1–9) and a <b>type</b>. Pick one Pokémon from the list.</li>
              <li>Tap it, then tap a slot on the top screen. You can reroll the era once and the type once.</li>
              <li>Your team has 3 free slots, two <b>Legend</b> slots (any legendary, mythical, Paradox or Ultra Beast Pokémon) and one <b>Mega</b> slot. No duplicates.</li>
              <li>After six picks your team fights each region's Elite Four and Champion. Win all 45 for a perfect run.</li>
            </ol>
          </details>

          <details className="how tips">
            <summary>Tips</summary>
            <ol>
              <li>
                <b>Stats matter, but not only stats.</b> A higher base stat total helps. A team of big numbers that all hit the
                same types still loses to the right opponent.
              </li>
              <li>
                <b>Cover a lot of types.</b> Your Pokémon attack with their own types. The more types your team can hit
                super-effectively, the fewer opponents give you trouble.
              </li>
              <li>
                <b>Fill your Legend and Mega slots.</b> Legends and Megas are the strongest Pokémon in the game, but they only
                fit their own slots. Regular Pokémon fit anywhere, so grab a good one when it shows up and build around it.
              </li>
              <li>
                <b>Save your rerolls.</b> You get one era reroll and one type reroll. Use them when a spin has nothing worth
                picking, not on the first spin that looks meh.
              </li>
            </ol>
          </details>

          <p className="fine">
            Unofficial fan project. Not affiliated with or endorsed by Nintendo, Game Freak, Creatures or The Pokémon Company.
            Pokémon and related names are trademarks of their owners. Non-commercial. Pokémon data from{' '}
            <a href="https://pokeapi.co" target="_blank" rel="noreferrer">PokéAPI</a>; trainer teams from{' '}
            <a href="https://pokemondb.net" target="_blank" rel="noreferrer">PokémonDB</a> and{' '}
            <a href="https://www.dittobase.com" target="_blank" rel="noreferrer">DittoBase</a>.
          </p>
        </div>
      }
    />
  )
}
