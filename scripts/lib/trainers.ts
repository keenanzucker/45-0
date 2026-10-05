import * as cheerio from 'cheerio'

export interface ParsedMon {
  /** Source slug: species slug on PokémonDB, PokeAPI-style form slug on DittoBase. */
  slug: string
  /** National dex number, when the source exposes it. */
  dex?: number
  /** Form label shown by PokémonDB (e.g. "Alolan Ninetales"). */
  label?: string
  level: number | null
}

export interface ParsedTrainer {
  /** PokémonDB section id (e.g. "elite4-1") or DittoBase npc card id (e.g. "lorelei"). */
  id: string
  name: string
  /** Set when a trainer has several teams, e.g. one per starter. */
  variant?: string
  team: ParsedMon[]
}

const LEVEL = /(?:Level|Lv\.)\s*(\d+)/i

export function parsePokemonDb(html: string): ParsedTrainer[] {
  const $ = cheerio.load(html)
  const trainers: ParsedTrainer[] = []

  $('h2[id]').each((_, h2) => {
    const id = $(h2).attr('id')!
    $(h2)
      .nextUntil('h2', '.infocard-list-trainer-pkmn')
      .each((_, card) => {
        const head = $(card).find('.trainer-head')
        const note = head.find('small').text().match(/\(([^)]+)\)/)?.[1]
        const team: ParsedMon[] = []

        $(card)
          .find('.trainer-pkmn')
          .each((_, mon) => {
            const data = $(mon).find('.infocard-lg-data')
            const link = data.find('a.ent-name')
            const smalls = data
              .children('small')
              .toArray()
              .map((el) => ({ text: $(el).text().trim(), hasType: $(el).find('.itype').length > 0 }))
            const dex = smalls.map((s) => s.text.match(/^#(\d+)$/)?.[1]).find(Boolean)
            const level = smalls.map((s) => s.text.match(LEVEL)?.[1]).find(Boolean)
            const label = smalls.find(
              (s) => !s.hasType && !/^#\d+$/.test(s.text) && !LEVEL.test(s.text),
            )?.text
            team.push({
              slug: link.attr('href')!.replace('/pokedex/', ''),
              dex: dex ? Number(dex) : undefined,
              level: level ? Number(level) : null,
              label,
            })
          })

        trainers.push({ id, name: head.find('.ent-name').first().text().trim(), variant: note, team })
      })
  })
  return trainers
}

export function parseDittoBase(html: string): ParsedTrainer[] {
  const $ = cheerio.load(html)
  const trainers: ParsedTrainer[] = []

  const parseTeam = (root: ReturnType<typeof $>): ParsedMon[] =>
    root
      .find('a[href*="/pokedex/"]')
      .toArray()
      .map((a) => {
        const link = $(a)
        const dex = link.find('img').attr('src')?.match(/\/(\d+)-[^/]*\.\w+$/)?.[1]
        const level = link.text().match(LEVEL)?.[1]
        return {
          slug: link.attr('href')!.split('/pokedex/')[1],
          dex: dex ? Number(dex) : undefined,
          level: level ? Number(level) : null,
        }
      })

  $('[data-npc-card]').each((_, card) => {
    const root = $(card)
    const id = root.attr('data-npc-card')!
    const name = root.find('h3').first().text().trim()
    const rows = root.find('[data-battle-team-row]')

    if (rows.length === 0) {
      trainers.push({ id, name, team: parseTeam(root) })
      return
    }
    rows.each((_, row) => {
      trainers.push({ id, name, variant: $(row).attr('data-battle-team-row'), team: parseTeam($(row)) })
    })
  })
  return trainers
}
