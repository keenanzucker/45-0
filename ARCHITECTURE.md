# Architecture

**45-0**: a static React game. Spin an era and a type (pull a lever), draft 6 Pokémon, then a deterministic
simulation fights the team against every generation's Elite Four and Champion (45 fights). No backend.
Read `SPEC.md` for product decisions, `docs/calibration.md` for how difficulty was tuned, `README.md` for setup.

## Commands

```bash
npm run dev            # Vite dev server
npm test               # vitest run (unit, component, integration)
npm run build          # tsc -b && vite build; run this after changes, it type-checks tests too
npm run lint           # oxlint
npm run calibrate      # simulation difficulty report (reruns take 1-2 min at defaults)
npm run build:pokemon  # PokeAPI -> public/data/pokemon.json + public/sprites/ (cached in .cache/)
npm run build:gauntlet # PokémonDB + DittoBase -> public/data/gauntlet.json
```

## Data flow

```
PokeAPI ──build:pokemon──► public/data/pokemon.json (1219 entries, 745 playable) + public/sprites/{id}.png
PokémonDB+DittoBase ─build:gauntlet─► public/data/gauntlet.json (45 fights, team = pokemon ids)
                                          │ fetched at startup (src/data/load.ts)
browser:  buildPool (engine/pool.ts) ─► useGame (state/useGame.ts) ─► screens/*  ─► engine/simulate.ts at the end
```

`public/data/*` and `public/sprites/` are **generated and checked in**. `public/trainers/` (one portrait per title, mapped in `src/results/titles.ts`) is hand-added. Don't hand-edit them; change
`scripts/` or `scripts/overrides/*.json` and rerun the script.

## Layout

| Path | What lives there |
|---|---|
| `src/data/types.ts` | Shared types: `PokemonEntry`, `GauntletFight`, `Category`, `Gen`, `POKEMON_TYPES`. Used by app and scripts. |
| `src/engine/` | **Pure game logic, no React, no I/O.** `pool` (playable pool + `(era,type)` index), `slots`, `spin`, `game` (state + reducer), `rng`, `typeChart` (`effectiveness`, plus `damageMultiplier` which also counts ability immunities), `battle` + `simulate` (scoring). `testUtils.ts` has `mkEntry`/`gridEntries` fixtures. |
| `src/state/` | `useGame.ts` (React hook: owns state, persistence, records results), `storage.ts` (localStorage run/stats, validated on load). |
| `src/results/` | `titles.ts` (rank by wins, plus its trainer portrait), `records.ts` (My records numbers, rank histogram, most-used podium), `analysis.ts` (weak spots, STAB coverage, carry/weak link), `lossSummary.ts` (the one-line "why you lost", via what-if replays), `battleLog.ts`, `share.ts` (team code `n.<base36 ids>`, share text, per-generation squares). |
| `src/ui/` | `listing.ts` (pick-list sort/filter, unavailable reasons), `labels.ts`, `fallers.ts` (seeded start-screen scene), `useCountUp.ts` (count-up hook, instant under reduced motion). |
| `src/screens/` | `Game.tsx` (router: shared link / start / draft / results), `StartScreen`, `DraftScreen`, `ResultsScreen` (your own run), `SharedScreen` (someone else's team from a link: team, challenge, build-your-own button), `RecordsScreen` (opened from the start screen; a run's FULL ANALYSIS reuses `ResultsScreen` with `onBack`; both routed by local state in `Game.tsx`). |
| `src/components/` | `DsShell` (Nintendo DS body), `Reels`, `Lever`, `TeamBoard`, `PickList`, `StatBars`, `TypeBadge`, `Sprite`, `ResultTop` (Hall of Fame top screen), `Breakdown` (analysis + fights), `HeroArt` (start-screen falling sprites + animated logo). |
| `src/index.css` | All styling (one file, section comments). Fonts are imported in `src/main.tsx`. |
| `scripts/lib/` | Tested pipeline modules: form classification (`forms`), finality (`evolution`), categories (`classify`), ability immunities (`abilities`), PokeAPI fetch+cache (`api`), trainer scraping (`trainers`, `resolve`, `gauntlet`), `validate`, calibration bots (`draft`). |
| `scripts/overrides/` | Hand-maintained lists that drive generation: `restricted-legendaries`, `paradox`, `ultra-beasts`, `starters`, `forms-include`, `forms-exclude`, `final-evolution-overrides`, `gauntlet-fixes`. |
| `scripts/gauntlet-config.ts` | Which 45 fights, and the source game/trainer ids on each site. |

## Core rules and where they are enforced

- **Pool**: only `isFinal` entries are playable (`engine/pool.ts`). The data file also keeps non-final Pokémon because
  gauntlet teams use them. Regional forms, Megas, Primals and a curated list of alternate forms are separate entries
  (ids 10000+). `category` is `normal | legend | mega`; legend-class entries also get a `legendKind` (`box-art | legendary | mythical | paradox | ultra-beast`, shown as the card tag), both computed in `scripts/lib/classify.ts`.
- **Slots** (`engine/slots.ts`): `SLOTS = [normal, normal, normal, legend, legend, mega]`. Specials are **caps, not
  requirements**: a normal can fill any open slot, a legend only a legend slot (either one), a mega only the mega slot. One entry per **species** (`speciesId`).
- **Spins** (`engine/spin.ts`): a spin only lands on an `(era, type)` combo with `MIN_CHOICES` (=2) selectable
  *distinct species* given the current roster. Rerolls (one era, one type per game) never fall back to thin combos;
  if no alternative is valid the reroll is unavailable (`canReroll`).
- **Lever** (`engine/game.ts`): `newGame` and every `place` leave `spin: null`; the `pull` action draws the next spin
  from the saved `rng`. `canPull(state)` drives the lever. The reducer is pure, JSON-safe, and **throws** on illegal
  actions, so the UI must only offer legal ones (`canPull`, `canReroll`, `currentResults().selectable`, `placementSlots`).
- **Randomness** (`engine/rng.ts`): pure mulberry32 over an integer state stored in `GameState.rng`. Never use
  `Math.random()` in the engine; the same seed must replay the same game.
- **Modes**: `GameState.mode` is `normal | hard`. Rules and scoring are identical; hard mode is presentation only
  (`PickList`, `TeamBoard`, `listing.ts` hide stats/types and force A-Z order; slot tags stay, but only as LEGEND or MEGA, not the kind; results reveal everything).
- **Scoring** (`engine/simulate.ts`, `battle.ts`): each fight is a sequential team battle (best counter vs the
  opponent's party order, damage carries over). Ability immunities (`immunities` on an entry, 0× for that type) apply to both sides through `damageMultiplier`. Opponent stats are normalized to a BST target. All constants are in
  `DEFAULT_PARAMS` and were **calibrated** (`scripts/calibrate.ts`); if you change the model or pool, rerun it and
  update `docs/calibration.md` and `SPEC.md` §6. A fight is won iff `margin > 0`.
- **Battle log**: `simulate()` attaches a `FightTrace` (opponents, every duel with type matchup/speed/rates/hp lost,
  hp left) to each `FightOutcome`. `results/battleLog.ts` turns it into console output (one collapsed group per fight
  plus a summary table). It only prints when the page URL has `?debug` (`isDebugLogging`; works on shared links too, e.g. `/?t=…&debug`); `ResultsScreen` and `SharedScreen` call it through `results/useBattleLog.ts`.
- **Persistence** (`state/storage.ts`): keys `45-0:run` (resumable run, validated by `isValidState`) and `45-0:stats`
  (best per mode, lifetime `totals` per mode including `titles` and per-Pokémon `picks`, last 50 runs; old saves without `totals` are rebuilt from history in `loadStats`). The result is recorded once, inside `useGame.dispatch` when the game turns `done`.
- **Share**: `?t=<code>` opens a finished team read-only (`Game.tsx` → `SharedScreen`). Text format and the
  `SITE_URL` (`VITE_SITE_URL`, default `https://45-0.com`) are in `results/share.ts`.

## Common changes

| To change… | Edit |
|---|---|
| Slot layout / rules | `engine/slots.ts`, then `spin.ts` validity, `PickList`/`TeamBoard`, and `SPEC.md` §3 |
| Difficulty or scoring feel | `DEFAULT_PARAMS` in `engine/battle.ts`; verify with `npm run calibrate` |
| Add or remove an alternate form | `scripts/overrides/forms-include.json`, `npm run build:pokemon` |
| Drop a duplicate form (e.g. a Mega that only differs in color) | `scripts/overrides/forms-exclude.json`, `npm run build:pokemon` |
| Fix a mis-classified Pokémon (legendary/paradox/starter/finality) | the matching `scripts/overrides/*.json`, rerun `build:pokemon` |
| Fix a gauntlet team | `scripts/overrides/gauntlet-fixes.json` (fight id → pool slugs), `build:gauntlet`; add fights in `scripts/gauntlet-config.ts` |
| Results screen | `screens/ResultsScreen.tsx`: team squares on top (`HofMon`), then `components/Analysis.tsx` (numbers in `results/analysis.ts`) and `components/FightsList.tsx` in one scroll |
| Rank titles | `results/titles.ts` (+ test, `SPEC.md` §7) |
| Share text | `results/share.ts` (+ test); the shared-link page is `screens/SharedScreen.tsx` |
| Records view stats | `results/records.ts` (`summarize`, `runsFor`, `mostUsed`), `screens/RecordsScreen.tsx`; new lifetime counters go in `ModeTotals` in `state/storage.ts` |
| Look and feel | `src/index.css` and the component; fixed-height slots and the numerals rule exist on purpose |
| A new screen | add under `src/screens/` and route it in `screens/Game.tsx` |

## Testing conventions

- TDD: write the failing test first. Names: `it("should <behavior> when <condition>")`. Colocate as `*.test.ts(x)`.
- `vite.config.ts` runs everything in `node`; component tests opt in with `// @vitest-environment jsdom`
  (`src/screens/Game.test.tsx` is the model: injects a `MemoryStorage`, a synthetic pool and `makeSeed`).
- `src/engine/game.integration.test.ts` plays 300 random games on the **real** data files; keep it passing when
  you change spin/slot/reducer logic. Unit tests use synthetic pools from `engine/testUtils.ts`.
- Test files are type-checked by `tsconfig.node.json` (`.ts`) or `tsconfig.app.json` (`.tsx`); `npm run build` runs both.
- Verify UI changes in a real browser (mobile viewport 390×844); the draft screen is layout-sensitive.

## Gotchas

- Pokémon ids ≥ 10000 are forms; compare species with `speciesId`, never `id`.
- `pool.byId` holds non-final entries too (needed for opponents); use `pool.playable` for anything the player can pick.
- Mega names derive from PokeAPI slugs (`scripts/lib/forms.ts`); odd slugs like `meowstic-female-mega` are handled and tested, and a species' only surviving Mega loses its form word (`plainSoleMegaNames`).
- Pixel fonts: body text and names are VT323; headings, buttons and numbers are Press Start 2P. Pixelify Sans was
  rejected because its capital C reads as O ("Cradily") and its 5 as S. Check names and digits before changing fonts.
- The top DS screen has a shared minimum height (`--top-screen-height` in `index.css`, the draft screen's natural top height) so
  the shell doesn't resize between screens. If the draft top panel changes height, update that variable.
- `.cache/` (API responses, scrape reports), `coverage/` and `.playwright-mcp/` are ignored scratch directories.
