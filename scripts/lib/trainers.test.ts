import { describe, expect, it } from 'vitest'
import { parseDittoBase, parsePokemonDb } from './trainers.ts'

const pdbCard = (opts: { name: string; note?: string; mons: string }) =>
  `<div class="infocard-list-trainer-pkmn"><span class="infocard trainer-head" ><br><br> <span class="ent-name">${opts.name}</span><br> <small>${opts.note ?? ''}<br> Mixed types</small></span>${opts.mons}</div>`

const pdbMon = (dex: string, slug: string, name: string, extra: string, level: number) =>
  `<div class="infocard trainer-pkmn"><span class="infocard-lg-img"><a href="/pokedex/${slug}"></a></span><span class="infocard-lg-data text-muted"><small>#${dex}</small><br> <a class="ent-name" href="/pokedex/${slug}">${name}</a><br> ${extra}<small>Level ${level}</small><br> <small><a href="/type/ice" class="itype ice">Ice</a> &middot; <a href="/type/fairy" class="itype fairy">Fairy</a></small></span></div>`

describe('parsePokemonDb', () => {
  const html = `<html><body>
    <h2 id="elite4-1">Elite Four #1</h2>${pdbCard({
      name: 'Lorelei',
      mons:
        pdbMon('087', 'dewgong', 'Dewgong', '', 54) +
        pdbMon('038', 'ninetales', 'Ninetales', '<small>Alolan Ninetales</small><br> ', 57),
    })}
    <h2 id="champion-5">Champion</h2>${pdbCard({
      name: 'Blue',
      note: '(Bulbasaur as starter)',
      mons: pdbMon('018', 'pidgeot', 'Pidgeot', '', 61),
    })}${pdbCard({
      name: 'Blue',
      note: '(Charmander as starter)',
      mons: pdbMon('009', 'blastoise', 'Blastoise', '', 65),
    })}
  </body></html>`

  const parsed = parsePokemonDb(html)

  it('should return one trainer per card, keyed by the section id', () => {
    expect(parsed.map((t) => [t.id, t.name])).toEqual([
      ['elite4-1', 'Lorelei'],
      ['champion-5', 'Blue'],
      ['champion-5', 'Blue'],
    ])
  })

  it('should parse slug, dex number and level for each Pokémon', () => {
    expect(parsed[0].team[0]).toEqual({ slug: 'dewgong', dex: 87, level: 54 })
  })

  it('should capture the form label shown under the name', () => {
    expect(parsed[0].team[1]).toEqual({ slug: 'ninetales', dex: 38, level: 57, label: 'Alolan Ninetales' })
  })

  it('should read the variant from the parenthesised note', () => {
    expect(parsed[0].variant).toBeUndefined()
    expect(parsed[1].variant).toBe('Bulbasaur as starter')
    expect(parsed[2].variant).toBe('Charmander as starter')
  })
})

const dittoMon = (slug: string, name: string, level: number, dex?: number, ace = false) =>
  `<a class="x" href="/game/pokedex/${slug}"><div><img src="https://assets.dittobase.com/x/pokemon/${dex ?? ''}${dex ? '-' : ''}${slug}.png" alt="${name}"/><p>${name}</p><span>Lv. <!-- -->${level}</span>${ace ? '<span>Ace</span>' : ''}</div></a>`

describe('parseDittoBase', () => {
  const html = `<html><body>
    <div data-npc-card="lorelei"><a href="/game/gym-leaders-elite-four/lorelei"><p>Elite Four</p><h3>Lorelei</h3></a>
      <div>${dittoMon('dewgong', 'Dewgong', 54, 87)}${dittoMon('ninetales-alola', 'Ninetales Alola', 57, 38)}</div>
    </div>
    <div data-npc-card="blue"><a href="/game/gym-leaders-elite-four/blue"><p>Champion</p><h3>Blue</h3></a>
      <section data-battle-team-row="player-picked-bulbasaur"><ul><li>${dittoMon('pidgeot', 'Pidgeot', 61, 18)}</li><li>${dittoMon('charizard', 'Charizard', 65, 6, true)}</li></ul></section>
      <section data-battle-team-row="player-picked-charmander"><ul><li>${dittoMon('blastoise', 'Blastoise', 65, 9)}</li></ul></section>
    </div>
  </body></html>`

  const parsed = parseDittoBase(html)

  it('should return one trainer per team, keyed by the npc card id', () => {
    expect(parsed.map((t) => [t.id, t.name, t.variant])).toEqual([
      ['lorelei', 'Lorelei', undefined],
      ['blue', 'Blue', 'player-picked-bulbasaur'],
      ['blue', 'Blue', 'player-picked-charmander'],
    ])
  })

  it('should parse slug, level and the dex number from the sprite url', () => {
    expect(parsed[0].team).toEqual([
      { slug: 'dewgong', dex: 87, level: 54 },
      { slug: 'ninetales-alola', dex: 38, level: 57 },
    ])
  })

  it('should keep team order within a variant', () => {
    expect(parsed[1].team.map((m) => m.slug)).toEqual(['pidgeot', 'charizard'])
  })

  it('should leave dex undefined when the sprite url has no dex number', () => {
    const [t] = parseDittoBase(
      `<div data-npc-card="x"><a><p>Elite Four</p><h3>X</h3></a>${dittoMon('foo', 'Foo', 10)}</div>`,
    )
    expect(t.team[0]).toEqual({ slug: 'foo', level: 10 })
  })
})
