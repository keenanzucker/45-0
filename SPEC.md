# 45-0 — Spec v0.1

Product name: **45-0**. Domain: **45-0.com**. Backup domains, available when checked: `pokespin.team`, `halloffame.run`.

A mobile-first web game inspired by 82-0.com. Spin an **era** (Gen 1–9) and a **type**, draft Pokémon from the matching list, fill a 6-slot team, then see what record the team posts against a gauntlet of every generation's Elite Four and Champion.

Items marked **[Assumption]** are defaults chosen to keep moving; they are listed again in [Open questions](#12-open-questions) and can be overruled.

---

## 1. Goals / non-goals

**Goals**
- Fun, fast draft loop (~3 min/game). Luck (spins) plus skill (coverage vs raw stats).
- Fully static: no backend. All data is JSON generated at build time.
- Deterministic scoring: same team → same record, so results are shareable and comparable.
- Learn the PokeAPI REST API by building the data pipeline against it.

**Non-goals (v1)**
- Movesets, abilities, items, levels, or a real battle simulator.
- Accounts, leaderboards, or any server.
- Gigantamax/Dynamax forms (excluded entirely).
- Histogram of score distribution in the UI (the distribution is calibration tooling only).

---

## 2. Core game loop

1. Game starts with 6 empty slots (see §3) and one **era reroll** and one **type reroll** available.
2. **Pull the lever**: a slot-machine lever on the top screen deals the next spin. Nothing is spun automatically, so the player decides when each spin happens (including the first). The app then picks an `(era, type)` pair at random and both reels land on it. Until the lever is pulled the reels show "?", the pick list is replaced by a prompt, and the rerolls are unavailable.
3. The player sees every eligible Pokémon matching that era and type (default sort: base stat total, descending).
4. The player picks one Pokémon and it fills a slot (§3).
5. After a placement the game waits for the lever again; repeat until all 6 slots are filled (6 spins total).
6. Results screen: record, per-fight breakdown, and share.

### Rerolls
- Exactly **one era reroll** and **one type reroll** per game, usable on any spin, independently.
- Rerolling the era keeps the current type, and vice versa. Example: spin gives Gen 2 + Water; rerolling only the type keeps Gen 2 and spins a new type.
- Each reroll is consumed on use. A reroll must produce a *valid* combo (§2.2) and should differ from the current value. A reroll replaces the current spin's value before you pick.
- The spin seed is created at game start and saved, so refreshing resumes the same run and can't be used to re-spin. A "New game" button (with confirm) abandons the run.

### 2.1 Pick rules
- No duplicate Pokémon.
- One entry per species: if you have Charizard you cannot also take Mega Charizard X. Regional forms count as their own species-form for this rule (Vulpix and Alolan Vulpix are different).
- A Pokémon can only be picked if there is an open slot it is allowed to fill (§3). Pokémon that can't fill any open slot are shown dimmed with a reason ("Legend slots full") and are not selectable.

### 2.2 Valid spin combos
- A spin (and any reroll) only lands on `(era, type)` combos that have at least `MIN_CHOICES` (**2**) selectable *species* given the current roster and open slots. Thin combos (2–4 species) stay in play deliberately: they are a good reason to use a reroll.
- Computed on the client from the pool; no empty or near-empty results. Weighting is uniform over valid combos unless tuning shows otherwise.
- A fresh spin falls back to any combo with at least one selectable entry only if no combo reaches `MIN_CHOICES` (a safety net; it never triggers with the real pool, where 154 of 162 combos are valid on an empty roster; the 8 excluded are the 2 empty combos, the 4 single-Pokémon combos, and Gen 1 Ghost and Gen 6 Poison, which are only a Pokémon plus its own Mega). A **reroll never falls back**: if no alternative era/type is valid, that reroll is unavailable and its button is disabled.
- With slots as caps (§3), `MIN_CHOICES` counts distinct species that can fill at least one open slot (a Pokémon and its Mega are one species); Normals always qualify while any slot is open, so a combo whose only entries are specials for filled slots drops out of the valid set.
- **[Assumption]** The era and type spinners are visually independent wheels but the result set is validated as a pair. Spin animation lands on the validated outcome.

### 2.3 Game modes
The mode is chosen on the start screen, fixed for the run, and saved with the run state. Rules, spins, rerolls, slots, simulation and scoring are **identical** in both modes. Only the information shown during the draft differs.

| | Normal mode | Hard mode ("IQ mode") |
|---|---|---|
| Pick-list order | BST descending (default) | Alphabetical by name, not sortable |
| Card contents | Sprite, name, type badges, BST, six stat bars, category badge | Sprite and name only |
| Types shown | Both types | None. The spun type is already known from the spin header, but the other type of a dual-type Pokémon is hidden |
| Stats shown | Yes | No |

- Slot restrictions (Legend, Mega) and no-duplicate rules still apply in hard mode. **[Assumption]** Eligibility *dimming* and the category filter chips stay, because they express rules, not hints. The slot badges stay on cards so the capped slots can be filled, but hard mode only says LEGEND or MEGA, not which kind of legend; stats and types are hidden. The pick list is a single column in both modes.
- **[Assumption]** The team board in hard mode shows only sprites and names for placed Pokémon (no types) until the results screen, where full types and stats are revealed.
- Results screen and share text carry a **Hard mode badge** (§7). Local stats track best record and history **per mode** (§7).

---

## 3. Slots

Six slots in three categories:

| Slot | Count | Eligible Pokémon |
|---|---|---|
| Normal | 3 | Non-legendary, non-mega, final-evolution Pokémon (includes pseudo-legendaries and regional forms) |
| Legend | 2 | Any legend-class Pokémon: box-art legends (the VGC restricted list plus Arceus), other legendaries (e.g. Suicune, Regis, Heatran, Tapus), mythicals, Paradox Pokémon and Ultra Beasts. Both slots are open to every kind; there is no limit on box-art legends. |
| Mega | 1 | Any Mega Evolution, including Legends Z-A Megas |

- Each spin shows one **mixed list** with category filter chips (All / Normal / Legend / Mega).
- **Tap to select, then tap a slot to place** (no instant picks): tapping a card selects it and expands full details; eligible open slots on the team board highlight; tapping one places the Pokémon there. Tapping elsewhere or the card again cancels.
- Special slots are **caps, not requirements** (decided): a team has at most two Legend Pokémon and one Mega, and may have none. A Normal Pokémon can be placed in **any** open slot, including the special ones. A Legend or Mega Pokémon can only go in its own slots.
- Consequence: a player can burn a special slot on a normal and lose the chance to use it later. That is intentional strategy. Because nothing is required, spins never need to guarantee a fillable special, and a run can always be completed.
- Placement is final (no undo in v1).
- If the only open slots a Pokémon could fill are gone (e.g. its special slot is already taken), its entry is shown dimmed.
- **Starter** is not a slot or category in v1. `pokemon.json` stores an `isStarter` flag (the 27 starter final evolutions) so a Starter mode or opening pick can be added later.

---

## 4. Pokémon pool (data rules)

Source of truth is `pokemon.json` (§9). Classification rules:

- **Final evolutions only** (decided). `pokemon.json` keeps *every* species, regional form and Mega, each with an `isFinal` flag; the game's pool is `entries.filter(e => e.isFinal)` (applied in the engine, not the data), so future modes can use unevolved Pokémon without regenerating data. The rule applies to every category, so unevolved legends and rares (Cosmog, Type: Null, Poipole, Meltan) are out of the game pool; their final forms are in. Because PokeAPI chains are per species, a base form that is only final when a *regional* form evolves (Mr. Mime, Qwilfish, Farfetch'd, Corsola, Linoone, Basculin) is fixed via `final-evolution-overrides.json`. A Pokémon is "final" if it has no further evolution (single-stage Pokémon count). Charmeleon, Togepi and the like are not shown. The same override file also lets three fan favorites through on purpose, Pikachu, Eevee and Magikarp (weak picks, and their evolutions stay in the pool). Branching lines: every end branch is final.
- **Regional forms** (Alolan, Galarian, Hisuian, Paldean) are their own entries with their own types and stats. Finality is evaluated per form (e.g. Alolan Raichu is final; Alolan Meowth is not). Needs overrides where PokeAPI chains are by species rather than form.
- **Megas** (Gen 6, Gen 7 Let's Go, and all Legends Z-A Megas) are entries with `category: "mega"`. Verified in PokeAPI: `charizard-mega-x` and `clefable-mega` both resolve, and the latter has a Z-A-era form ID (10278).
- **Alternate forms** are included via an explicit list (`scripts/overrides/forms-include.json`; the build fails on any unknown slug). They keep their species' slot category and obey the one-per-species rule (Kyurem and Kyurem Black block each other). Included: Ogerpon masks, Urshifu Rapid Strike, Kyurem Black/White, Dialga/Palkia/Giratina Origin, Rotom appliances, Oricorio styles, Wormadam cloaks, Necrozma Dusk Mane/Dawn Wings, Calyrex riders, Crowned Zacian/Zamazenta, Shaymin Sky, Hoopa Unbound, Meloetta Pirouette, Ursaluna Bloodmoon, Deoxys formes, Therian formes, Lycanroc Midnight/Dusk, Palafin Hero, and the female forms of Indeedee, Basculegion and Oinkologne. Displayed as e.g. "Ogerpon (Wellspring Mask)".
- **Duplicate forms** are dropped via `scripts/overrides/forms-exclude.json` (the build fails on any unknown slug): variants that repeat another entry's stats and types, such as Mega Magearna (Original), which differs from Mega Magearna only in color. Dropped: Mega Magearna (Original), Toxtricity (Low Key), Meowstic (Female), Mega Meowstic (Female), and Mega Tatsugiri Droopy and Stretchy. When one Mega is left for a species its form word is dropped too ("Mega Tatsugiri", "Mega Meowstic"). A data test fails if two playable entries of a species ever share types, stats and category.
- **Primal Kyogre and Groudon** are in the Mega category and use the Mega slot.
- **Excluded**: battle-only forms (Aegislash Blade, Darmanitan Zen, Castform weather, Wishiwashi School, Mimikyu Busted, Greninja Ash, Palafin Hero, Zygarde Complete, Terapagos Terastal, Koraidon/Miraidon modes, Eternamax), Totem forms, Gigantamax, and cosmetic forms.
- **Gigantamax** forms are excluded. Other cosmetic or battle-only forms are excluded unless they change types/stats meaningfully (decide per form during the build; start from an exclude-list).
- **Categories** (computed in the build script):
  - `legend`: every legend-class Pokémon, with a `legendKind` used for the card tag. First match wins: `box-art` (the restricted legendaries from a manually maintained list that follows the VGC restricted-legendary ruleset, plus Arceus, which PokeAPI flags as mythical; PokeAPI doesn't flag restricted status), `paradox` and `ultra-beast` (manually maintained lists; PokeAPI doesn't flag them), `mythical` (`is_mythical`), `legendary` (`is_legendary`, so sub-legendaries such as Articuno or the Tapus land here). Counts at the time of writing: 37 box-art, 53 legendary, 26 mythical, 20 paradox, 10 ultra beast.
  - `mega`: mega forms.
  - `normal`: everything else. Pseudo-legendaries (Dragonite, Tyranitar, Salamence, Metagross, Garchomp, Hydreigon, Goodra, Kommo-o, Dragapult, Baxcalibur) are `normal`.
- **Era assignment** (`gen` field):
  - Normal and legend: generation of species debut.
  - Regional forms: generation the form debuted (Alolan Vulpix = Gen 7).
  - Megas: generation of the base species (Mega Charizard X = Gen 1), so the Mega slot isn't limited to Gens 6/7/9.
- **Types** use the form's own types (Mega Charizard X = Fire/Dragon). Dual-typed Pokémon appear under either type.

---

## 5. Gauntlet

~45 fights: each generation's **Elite Four + Champion** (5 per gen). Tagged with `tier` so gym leaders (or more) can be added later to scale toward ~117.

| Gen | Region (source game) | Fights |
|---|---|---|
| 1 | Kanto (Red/Blue) | Lorelei, Bruno, Agatha, Lance, Blue (Bulbasaur-starter team) |
| 2 | Johto (Gold/Silver) | Will, Koga, Bruno, Karen, Lance |
| 3 | Hoenn (Ruby/Sapphire) | Sidney, Phoebe, Glacia, Drake, Steven |
| 4 | Sinnoh (Platinum) | Aaron, Bertha, Flint, Lucian, Cynthia |
| 5 | Unova (Black/White) | Shauntal, Grimsley, Caitlin, Marshal, Alder |
| 6 | Kalos (X/Y) | Wikstrom, Malva, Drasna, Siebold, Diantha |
| 7 | Alola (Sun/Moon) | Hala, Olivia, Acerola, Kahili, Kukui (Rowlet-starter team) |
| 8 | Galar (Sword/Shield) | No Elite Four: gym leaders Opal, Gordie, Piers, Raihan, plus Leon (Grookey-starter team) |
| 9 | Paldea (Scarlet/Violet) | Rika, Poppy, Larry, Hassel, Geeta |

- Starter-dependent teams (Blue, Kukui, Leon) use the first variant listed by the sources; the choice is recorded in `variant` in `gauntlet.json`.
- Opponents may include non-final Pokémon (Haunter, Dragonair, Shelgon, Sealeo, Golbat, ...); the pool data keeps them (`isFinal: false`) so every team resolves.
- Each opponent is a team of up to 6 Pokémon (species/form only, no levels or moves).
- **Normalization**: raw teams differ hugely in power across games (Gen 1 Elite Four are far weaker on paper than Gen 9). To keep every generation's fights comparably tough, each opponent team's stats are rescaled so the team's average BST hits a gauntlet-wide target. Species, types and each Pokémon's stat *shape* are preserved; only magnitude is scaled. The target (and whether champions get a small bonus over Elite Four members) is a calibration constant (§6.4).
- Data sources: no clean JSON exists. `scripts/build-gauntlet.ts` (`npm run build:gauntlet`) scrapes PokémonDB and DittoBase, resolves every Pokémon to a `pokemon.json` id, and compares the two teams (order-insensitive). Status per fight: `both-agree`, `conflict`, `single-source` or `manual`; the report is written to `.cache/gauntlet-report.txt`. Manual corrections go in `scripts/overrides/gauntlet-fixes.json` (fight id → pool slugs). Result: 44 of 45 fights agree; Leon is DittoBase-only (PokémonDB has no Champion Cup page) and was confirmed against Serebii. `public/data/gauntlet.json` is checked in and the scrape is not part of the normal app build.
- A "meet the gauntlet" browse page is deferred past v1.
- Each opponent mon references an entry in `pokemon.json` by `id`, so it uses the same stats and types as the player's side.

---

## 6. Simulation

Pure and deterministic; a full 45-fight simulation runs in the browser in a few milliseconds (`src/engine/simulate.ts`, `battle.ts`).

```ts
createSimulator(byId, gauntlet, params?).simulate(teamIds): {
  wins: number; losses: number;
  fights: { fightId: string; winProb: number; margin: number; won: boolean }[];
  lossDrivers: { type: PokemonType; share: number }[];   // top 3
}
```

**Scoring balance (decided)**: raw stats and type coverage matter about equally. A team with strong coverage can beat a higher-BST team with a big shared weakness (covered by a test), and a calibration check (§6.4) keeps BST from dominating.

**Data era (decided)**: current data everywhere. The modern 18-type chart (including Fairy) and PokeAPI's current types and base stats apply to all Pokémon, including Gen 1 opponents. Abilities, moves and items are ignored.

### 6.1 Matchup model

Each fight is a deterministic **sequential team battle**. Opponents come out in party order; my side always sends the alive Pokémon with the best duel ratio against the current opponent; damage carries over between duels.

- **Attack rate** (hp fraction removed per attack) of attacker `a` on defender `d`:
  `eff × (max(atk/def, spa/spd) / hp) ^ statExponent`, where `eff = max(stabWeight × bestSTABEffectiveness, coverageFloor)`. A Pokémon's best STAB type against the defender's types is used; when STAB is resisted or immune it falls back to a generic neutral coverage move (`coverageFloor`), so resistances and immunities still matter but a Normal type is not helpless against Ghost.
- **Ability immunities**: a Pokémon that always has an ability granting full immunity to a type (Levitate for Ground, Volt Absorb for Electric, ...) takes no damage from that type, so a STAB attack of that type counts as 0× and falls back to the coverage floor. This applies to both sides; opponents use the same table. Only guaranteed immunities are modelled (§4); the rest are listed in §13.
- **Speed** is a bounded damage bonus/penalty: the faster Pokémon's rate is multiplied by `1 + ε` and the slower's by `1 − ε`, with `ε = speedWeight × tanh(speedSlope × ln(speedRatio))`.
- **Duel**: with rates `ab` and `ba` and current hp fractions, the time to KO is `hp_opp / ab` vs `hp_mine / ba`; the faster kill wins and the winner keeps the remaining hp fraction.
- **Result**: if I win, `margin` = my remaining hp (in Pokémon units); if I lose, `margin` = −(opponent's remaining hp, counting unfought Pokémon as full). `winProb = logistic(margin / marginScale)` and a fight is **won iff `margin > 0`** (i.e. `winProb ≥ 0.5`).
- **Opponent normalization**: each opponent team's stats are scaled by one factor so its average BST equals `oppTargetBst × (champion ? 1 + championBonus : 1) × (1 + teamSizeBonus × (6 − teamSize))`. Species, types and stat shape are preserved. The team-size term keeps 4- and 5-Pokémon teams as hard as 6-Pokémon teams.

### 6.2 Calibrated constants (`DEFAULT_PARAMS`)

| Constant | Value | Role |
|---|---|---|
| `statExponent` | 0.5 | Compresses stat differences so type coverage matters as much as BST |
| `stabWeight` | 1.5 | Same-type attack bonus |
| `coverageFloor` | 0.6 | Power of the generic coverage move |
| `speedWeight` / `speedSlope` | 0.25 / 1 | Speed effect |
| `marginScale` | 0.5 | Win probability slope (display only) |
| `oppTargetBst` | 610 | Difficulty; a model constant, not a literal BST |
| `championBonus` | 0.05 | Champions slightly harder |
| `teamSizeBonus` | 0.15 | Per opposing Pokémon fewer than six |

### 6.3 Loss drivers
In lost fights, the engine totals the **super-effective damage** each opposing attacking type dealt to the team (the opponent's best STAB type against the Pokémon it hit), and returns the top 3 types by share, e.g. "Most losses came from Flying (49%), Poison (15%), Ice (13%)". If no super-effective damage was taken (or there were no losses) the list is empty and the UI says the team was outclassed or shows nothing. There is no weakest-link display.

### 6.4 Calibration (`npm run calibrate`)
`scripts/calibrate.ts` plays random drafts under the real spin and slot rules, a **BST picker** (always the highest-BST selectable Pokémon, never rerolls; a casual-but-sensible player), a **greedy expert bot** (maximizes simulated expected wins and uses rerolls when the expected gain is worth it), and a hill-climbed **best possible team**. Results with `DEFAULT_PARAMS` (details in `docs/calibration.md`):

| Player | Mean wins /45 | Notes |
|---|---|---|
| Random drafts (n=20,000) | 21.8 | target 20–25 |
| BST picker (n=2,000) | 34.1 | 0.35% perfect runs (target 0.1–1%) |
| Expert bot (n=300) | 39.9 | 6.0% perfect |
| Best possible team | 45-0 | a perfect run is reachable |

- Fight difficulty is even across generations (40–54% random win rate), tiers (45–52%) and opponent team sizes (43–52%).
- No type or era dominates the top decile of random drafts: the most over-represented types are Steel (1.43×), Dragon (1.37×) and Dark (1.30×); the least are Normal (0.51×), Bug (0.57×) and Poison (0.61×). Legendaries (2.5×) and Megas (1.6×) are over-represented, as expected from their stats.
- Calibration targets are defined for **normal mode** (full information). Hard mode uses the same simulation, so the same distribution applies; human performance is just lower. Rank thresholds are shared across modes.
- Optionally ship a small `distribution.json` (about 100 buckets). Not shown as a histogram in v1. Whether to show a percentile line is an open question.

---

## 7. Results screen & sharing

**Results screen**
- After the 6th pick, a short count-up animation runs to the final record, then the breakdown appears. Honors `prefers-reduced-motion` (skips to the result).
- Headline record (e.g. `38–7`) with a flavor **title/rank** from the Pokémon trainer ladder, and a flourish for perfect or near-perfect runs. Draft thresholds (wins out of 45; retuned against calibration so each tier is reachable):

  | Wins | Title |
  |---|---|
  | 0–14 | Youngster |
  | 15–24 | Ace Trainer |
  | 25–32 | Gym Leader |
  | 33–39 | Elite Four |
  | 40–44 | Champion |
  | 45 | Pokémon Master |

- Otherwise kept minimal: no percentile line, no histogram.
- Each title has a trainer portrait (Youngster, Ace Trainer, Brock, Lance, Cynthia, Red), shown beside the record on the top screen. The 80×80 PNGs are self-hosted in `public/trainers/` (from Pokémon Showdown's trainer sprite set) and mapped in `results/titles.ts`.
- **Top screen** (Hall of Fame style): the six Pokémon in two rows of three around the record and title, each as name above the sprite, then BST and small type tags (FIR, WAT, …) below, with no panel behind them. Squares pop in one after another while the record counts up (skipped with reduced motion). Sizes are tuned so the top screen keeps the same height as every other screen. Sprites bob gently on their own beats and hop when tapped (every tenth tap on one sprite is a spin); a 45–0 run adds a 👑 per sprite, a gold shimmering record and a few seconds of confetti. All motion is off with reduced motion.
- **Bottom screen**: one scroll headed by a centered "Analysis" title, with Share and Play again pinned below it, in this order:
  - **Team badges** (`results/badges.ts`): up to three small chips under the title, first matches in this order: 🔥 Mono-type (all six share a type), 🗺️ One-region team (one generation), 🌍 World tour (six generations), 🚫 No legends (no legend-class), 🐣 Underdog (average BST under 540 and 35+ wins), 🪞 Dual-type only, ⚡ Speed demons (average Speed ≥ 100), 🧱 Wall of stats (average BST ≥ 600). Nothing is drawn when none apply. The BST and Speed cutoffs sit against random drafts (average team BST about 547, Speed about 86); retune with `docs/calibration.md` if the pool changes.
  - **Carry and weak link** cards (no heading; the cards are labeled): per-Pokémon totals over all duels (knockouts, times fainted, opponent hp dealt, own hp taken, in whole-Pokémon units); carry = largest dealt − taken, weak link = smallest (omitted if it would be the carry);
  - **One "why you lost" line** (`results/lossSummary.ts`). Two what-if replays (`Simulator.fightsWon` with a STAB adjustment) decide whether defense or offense cost more fights: opponents never hitting super-effectively, versus the team hitting every type it otherwise can't hit super-effectively. If offense saves more fights, the line is "In 10 of 11 losses, the opponent left standing was a type your team can't hit super-effectively (Flying, Psychic, Water, Fairy)." Otherwise (including ties) it is the loss-driver line from §6.3, "Most of your losses came from Ground (57%), Water (16%) attackers." No losses: "Flawless. Nothing got through."; nothing super-effective and no offense gap: "Your team was simply outclassed.";
  - **Defense: weak spots**, with a one-line explanation ("Damage each type deals to your Pokémon…"): attacking type × team member matrix with game multipliers (×4, ×2, ½, ¼, 0), the five most exposed types first, "Show all 18" to expand. Column headers show each Pokémon's sprite; the same headers are used for type coverage. Ability immunities show as ×0 in the cell (for example Ground against Rotom (Heat)); there is no separate label on the cards;
  - **Offense: type coverage**, with a one-line explanation ("Which types your team can hit super-effectively, or not, with its own types (STAB)"): the same grid shape for offense. Rows are defending types (least covered first, five shown, "Show all 18" to expand), columns are the team; a cell is ×2 when that member's own (STAB) types hit that type super-effectively, ½ or 0 when its best attack is resisted or immune. A line below says how many of the 18 types are covered and names the missing ones.
  - **Fights**: the nine per-generation result squares, then every fight grouped by generation (expandable, marking wins and losses and listing the opposing team by name).
- Play again.

**Hard mode badge**: the results screen shows a "Hard mode" badge next to the title when applicable. Normal mode shows no badge.

**Local stats** (no backend): `localStorage` keeps best record, games played, lifetime totals per mode (fights won and lost, perfect runs, runs per title, runs each Pokémon was on the team) and the last 50 runs (team, record, date, mode). The **My records** screen (button on the start screen) has All / Normal / Hard tabs. The top screen shows runs, best record, average wins, perfect runs and fight win rate, a **podium** of the three most-used Pokémon (lifetime counter, so it doesn't reset as runs age out of the 50; ties go to the lower id; each Pokémon with its count stands on a connected step with a 🥇/🥈/🥉 medal, first place in the middle and tallest), and a **results-by-rank histogram** (one bar per title, trainer portrait underneath, zero for ranks never earned; lifetime). The bottom screen lists the best run and recent runs; each run shows its trainer portrait beside the title and expands to its six Pokémon with sprite, name and BST plus the overall record, and a **FULL ANALYSIS** button that opens the normal results screen for that team (recomputed with today's data and scoring, with Back returning to the records; hidden when the run includes a Pokémon no longer in the pool). Saves from before lifetime totals or pick counts existed rebuild them from their recent history. No daily-seed mode in v1 (the seedable RNG in §9 keeps it possible later).

**Share text**: copied to the clipboard, or via `navigator.share` on mobile. The first line is a sentence, not a code, so the record isn't confused with the game name. It carries the emoji of the rank earned (👑 Pokémon Master, 🏆 Champion, 🥇 Elite Four, 🏅 Gym Leader, ⭐ Ace Trainer, 🎒 Youngster), the team line starts with ⚔️ and the link with 👇:

```
I just went 43–2 on 45-0 🏆 (Champion). Build a team that beats it.
⚔️ Alolan Muk · Scizor · Oricorio · Tapu Bulu · Kyurem (Black) · Mega Tyranitar
👇 https://45-0.com/?t=<encoded-team>
```

- Hard mode adds "🧠 Hard Mode" after "45-0"; a perfect run ends "Build a team that matches it." The per-generation squares are not part of the text (they stay on the results screen's Fights section). The team names stay because the link preview is a generic image.
- **Shared view**: the link carries an encoded team (Pokémon IDs) and the mode. Opening it shows a different screen from the player's own results: the Hall of Fame top screen (team, record, trainer, title, hard mode badge) and, below, "Can you beat 43–2?" (perfect runs: "Can you match 45–0?"), the one-line pitch and a BUILD YOUR OWN TEAM button right under it. There is no analysis on this screen; the lower half is mostly empty on purpose.

---

## 8. UX / visual direction

- **Mobile-first**, portrait layout (like 82-0). Desktop is centered at a phone-like width.
- **Nintendo DS look (decided: full shell)**: a console body with a top screen (spin reels, rerolls and the six team slots) and a bottom touch screen (pick list and actions), joined by a hinge. On desktop the console is centered at phone width. Fonts: Press Start 2P for headings, buttons and numbers; VT323 for body text and Pokémon names. Pixelify Sans was tried and dropped because its capital C reads like an O ("Cradily" looked like "Oradily") and its 5 like an S.
- **Reels (decided)**: two slot-machine reels (era and type), each with its own reroll button; a reroll re-spins only its reel. Pure CSS animation, deterministic per spin, instant under `prefers-reduced-motion`.
- **Pick list sorting (decided)**: normal mode sorts by BST (default), any single base stat, or name, plus category chips; unselectable entries always sink to the bottom. Hard mode is alphabetical only, with just the category chips.
- **Sprites**: PNG pixel sprites, rendered with `image-rendering: pixelated`.
  - PokeAPI's sprites repo serves each Pokémon at `sprites/pokemon/{id}.png` (including form IDs such as 10278), plus `versions/generation-iv|v/...` DS-era sets.
  - Dream-world SVGs exist but are vector art, not pixel style.
  - **Verified**: `front_default` resolves for Pokémon 1010 and for Z-A form 10278. Coverage of the Gen IV/V DS-style sprites for later gens was spot-checked only (`700` exists for Gen V) and must be validated per ID in the build script, with `front_default` as the fallback.
  - Self-host sprites in `public/sprites/` (downloaded at build time) rather than hotlinking GitHub raw.
- **Pick-list card (normal mode)**: sprite, name, type badges, BST, six base-stat bars (HP/Atk/Def/SpA/SpD/Spe), and a tag for what it is: BOX ART / LEGENDARY / MYTHICAL / PARADOX / ULTRA BEAST for legend-class Pokémon, MEGA for Megas. **Hard mode**: sprite, name and a generic LEGEND or MEGA tag (§2.3). One card component takes a `mode` prop.
- Spin animation: era wheel and type wheel, with a "lock" effect when each lands. Honor `prefers-reduced-motion`.
- **Start screen top**: the 45-0 logo counts its first number up from 0 and then gets a slow shine sweep, and 14 random Pokémon (distinct, any playable entry) drift down behind it, swaying at different speeds and sizes. The scene is seeded per visit and already mid-fall on load, and each sprite that restarts at the top becomes a different Pokémon that isn't already on screen, so it keeps changing. Under the logo, one line in a translucent panel (so it stays readable over the sprites) explains the game: "Build an elite team of six to take on the 45-trainer gauntlet." It is decorative only (`aria-hidden` sprites; the heading reads "45-0"), shows no stats or types, and under `prefers-reduced-motion` the sprites are hidden and the logo is static.
- **No audio in v1.**
- **Public, non-commercial** (decided). Pokémon names, sprites and trainer data are Nintendo / Game Freak / The Pokémon Company IP, and PokeAPI's data and sprite repo doesn't grant rights to them. Mitigations:
  - Footer disclaimer on every page: unofficial fan project, not affiliated with or endorsed by Nintendo, Game Freak, Creatures or The Pokémon Company; Pokémon and related names are trademarks of their owners; non-commercial.
  - No ads, tracking-for-profit, paid features or merch.
  - Credit PokeAPI (and the trainer-data sources) in an About section.
  - Keep sprite paths behind one config so assets can be swapped quickly if a takedown request arrives.
- Accessibility: pick list is a real list with buttons, color-independent type labels, keyboard operable on desktop.

---

## 9. Technical architecture

- **Stack**: Vite + React + TypeScript, **npm**, static deploy on Vercel. No backend, no runtime API calls.
- **Repo**: the maintainer sets up git and GitHub; implementation work doesn't run git commands.
- **State**: a single reducer (`useReducer` or a small store) for the game state: `mode` (`'normal' | 'hard'`), `roster`, `currentSpin`, `rerollsLeft`, `phase`. Persist to `localStorage` so refresh doesn't lose a run.
- **RNG**: seedable PRNG (mulberry32 or similar), so a daily-challenge mode can be added later with no backend.
- **Pure logic modules** (no React) in `src/engine/`, the unit-tested core. Built so far: `typeChart` (modern 18-type chart), `rng` (seedable mulberry32 as pure functions over an integer state), `slots` (slot layout, placement rules, one-species rule), `pool` (playable pool, `(era, type)` index, selectable counts, valid spins), `spin` (draws and rerolls), `game` (`newGame`, `gameReducer`, `canReroll`, `currentResults`), `battle` (matchup and sequential-battle model) and `simulate` (`createSimulator`, §6). Still to build: `share`. Calibration tooling lives in `scripts/` (`calibrate.ts`, `lib/draft.ts`).
- **Game state** is plain JSON: `{ mode, seed, rng, roster, spin, rerollsLeft, phase }`, with `roster` holding one pokemon id (or null) per slot in `SLOTS` order (normal ×3, legend ×2, mega). `spin` is null while the next spin is waiting for the lever (`canPull`) and once the roster is full. `gameReducer` is pure and throws on illegal actions (`pull`, `place`, `reroll`); the UI is expected to only offer legal ones using `canPull`, `currentResults` (which flags unselectable entries) and `canReroll`. The spin is drawn from the saved rng at pull time, so for a given seed the spin sequence is the same as before the lever existed, and reloading while waiting cannot be used to re-roll a spin.

### Layout
```
45-0/
  scripts/
    build-pokemon.ts     # PokeAPI REST → public/data/pokemon.json (+ sprites)
    build-gauntlet.ts    # curated source → public/data/gauntlet.json
    calibrate.ts         # offline simulations
  src/
    engine/
    components/
    data/                # loaded pokemon.json / gauntlet.json
  public/
    data/
    sprites/
```

### Data pipeline (`build-pokemon.ts`)
- Hits PokeAPI REST (`/pokemon`, `/pokemon-species`, `/evolution-chain`, `/type`). No rate limit, but fair-use policy asks for local caching, so the script caches raw responses on disk and is idempotent.
- `/pokemon?limit=…` returns about 1,351 entries (species plus forms); the script filters and classifies per §4.
- Emits slim records:

```ts
type PokemonEntry = {
  id: number;            // PokeAPI pokemon id (form ids are 10000+)
  slug: string;          // PokeAPI pokemon name, e.g. "charizard-mega-x"
  name: string;          // display name, e.g. "Mega Charizard X"
  speciesId: number;
  gen: 1|2|3|4|5|6|7|8|9;
  types: PokemonType[];   // 1–2
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  bst: number;
  category: 'normal' | 'legend' | 'mega';
  legendKind?: 'box-art' | 'legendary' | 'mythical' | 'paradox' | 'ultra-beast';  // legend-class only
  isStarter: boolean;     // starter final evolutions; unused in v1 rules
  isFinal: boolean;       // game pool = isFinal entries
  immunities?: PokemonType[]; // types it takes no damage from via an always-present ability (§6.1)
  sprite: string;        // path under /sprites
};
```
- A validation step fails the build on: missing sprite, missing stats, unclassified category, or an opponent referencing an unknown `id`.
- `immunities` (optional, only when present): types the Pokémon takes no damage from through an ability every version of it has; computed from PokeAPI abilities in `scripts/lib/abilities.ts`, not hand-edited.
- Manual override files (checked in): `paradox.json`, `ultra-beasts.json`, `legendary-tiers.json`, `forms-exclude.json`, `final-evolution-overrides.json`.

---

## 10. Testing

- **Engine unit tests** (Vitest): type chart sanity (e.g. Ground vs Flying = 0×), slot assignment, no-duplicates, spin validity (never empty, reroll consumption rules), simulate determinism and monotonicity (adding a strictly stronger mon never lowers the record).
- **Data tests**: pool counts per category, every gauntlet reference resolves, every Pokémon has a sprite, every `(gen, type)` pair has the expected minimum eligible set.
- **Calibration** as in §6.4. Not a unit test, but results are checked into `docs/calibration.md` when constants change.
- **E2E (Playwright)**: play one full game on a mobile viewport, verify the results screen and the share text.

---

## 11. Milestones

1. **Data** (done): `build-pokemon.ts`, classification, sprites, validation.
2. **Gauntlet** (done): `build-gauntlet.ts`, two-source cross-check, frozen `gauntlet.json`.
3. **Engine** (done): type chart, spin and eligibility, slots, reducer, tests.
4. **Simulation + calibration** (done): battle model, offline calibration, tuned constants.
5. **UI** (done, first pass): start, draft (both modes), results, share text and link, local stats, resume, DS shell. Verified in a real browser at 390×844 and 1280×800. Still open: favicon/social image, accessibility audit, keyboard flow on desktop, sound (deferred).
6. **Deploy** to Vercel.

---

## 12. Open questions

Resolved: two open Legend slots for every legend-class Pokémon (this replaced the earlier Rare and Legendary slots), tagged by kind on the cards; one entry per species, win threshold at 50%, results kept minimal with titles/ranks, final evolutions only, perfect run very rare but real (~0.1–1% for a good strategy), Hoenn champion is Steven.

1. **Product name** (decided): 45-0 at 45-0.com. The name is tied to the 45-fight gauntlet, so expanding the gauntlet later (§13) would mean renaming or reframing it (e.g. "45-0" as the classic mode). Other names considered: Pokéspin, Champion Run, Dex Draft, Hall of Fame, Gauntlet 45, Spin to Win, Elite Draft, Rival Run, Final Team.
2. **Rank thresholds**: the table in §7 is a draft to retune after calibration.
3. **Daily-seed mode**: deferred past v1 (not selected).
4. **Normalization target** and champion bonus (§5): set during calibration.
5. **Hard mode details** (§2.3, both assumptions): are category badges hidden and eligibility dimming kept? Are types hidden on the team board until results?
6. **Hard mode name**: "Hard mode", "IQ mode", or something else.
7. **Final-evolutions-only** means unevolved Pokémon are in the data (`isFinal: false`) but never appear in the game pool, apart from three fan favorites kept in on purpose: Pikachu, Eevee and Magikarp (`final-evolution-overrides.json`). They are weak picks, and their evolutions stay in the pool too. A full "all Pokémon" mode was measured and rejected: random drafts fall from about 22 to 10 wins, and it needs a one-per-evolution-line rule. Alternate forms are resolved (§4).
7. **Link previews**: shared links show a generic preview image; per-team previews would need a Vercel edge function (§13).
8. **Share URL**: production share links use `https://45-0.com` (`SITE_URL` in `results/share.ts`, overridable with `VITE_SITE_URL`); `npm run dev` points them at `http://localhost:5173` through `.env.development` so they can be tested locally.

---

## 13. Potential follow-ups (not in v1)

Ideas discussed and deliberately deferred. The v1 architecture keeps them cheap (seedable RNG, pure engine, tagged gauntlet, `isStarter` flag).

- **Challenge link (shared seed).** The share link carries the game's spin seed (plus mode). A friend opens it and plays the *same* spin sequence, then compares records. Since rerolls consume from the same seeded stream, the sequence is deterministic. Needs: seed encoded in the URL, a "Challenge" banner on the start screen, and a rule for rerolls (they must also be seed-deterministic, so use a separate sub-stream per reroll slot). No backend.
- **Daily challenge.** Same machinery, with the seed derived from the date (UTC). Adds a streak counter in `localStorage`. Possible extra: a countdown to the next daily.
- **Team badges.** Pure functions of the final team, shown on results and in the share text: Rainbow (6 distinct primary types), One-Gen Wonder (all one era), Mono-type, Gen Spread (6 different gens), No Specials (zero Legend/Mega). Hard mode already has its own badge.
- **Fight highlights.** Using per-fight `winProb`: "Closest win" (lowest winning prob), "Biggest upset" (lowest prob among wins), "Toughest opponent" (lowest prob overall), "Narrowest loss". A few lines on the results screen.
- **Post-run swap analysis.** After the run, evaluate every single-slot swap against the pool (`simulate` is cheap) and show the best one: "Swapping Garchomp for Metagross would have made you 41–4". Strong replay hook. Needs care in hard mode (reveals information only after the run, which is fine).
- **Image share card.** Generate a PNG client-side (canvas) with the team sprites, record, title and badge for saving or `navigator.share({ files })`, alongside the text share. A later upgrade is per-team link previews via a Vercel edge function (`@vercel/og`), which would be the first server-side piece.
- **Local Pokédex collection.** A page listing every Pokémon ever drafted, with counts, a "drafted X of N" progress bar and per-category completion. `localStorage` only.
- **Variants.** One-Gen Run (all spins locked to one era), Mono-Type Run (type locked), No-Rerolls, Speed Draft (timed picks), Starter Mode (opening pick from a gen's starters using `isStarter`).
- **Meet the gauntlet page.** Browsable list of all opponents and teams (see §5).
- **Gauntlet expansion.** Add gym leaders via the `tier` tag to scale toward ~117 fights and finer records.
- **Ability immunities beyond the guaranteed ones.** v1 models full type immunities from abilities only when *every* ability a Pokémon can have grants the same immunity (35 playable entries: Rotom and its forms, Flygon, Mismagius, Hydreigon, Latias/Latios, Cresselia, Uxie/Mesprit/Azelf, Eelektross, Zeraora, Giratina (Origin), Thundurus (Therian), Mega Sceptile, Mega Delphox, ...). The game has no ability choice, so the other 72 playable entries, which can have an immunity ability but don't always, get nothing for now. They are ability-dependent:
  - Electric (19): Pikachu, Raichu, Marowak (+ Alolan), Seaking, Jolteon, Manectric, Plusle, Minun, Pachirisu, Rhyperior, Electivire, Emolga, Togedemaru, Pincurchin, Dracozolt, Arctozolt, Pawmot, Kilowattrel.
  - Fire (15): Ninetales, Arcanine (+ Hisuian), Rapidash, Flareon, Typhlosion, Houndoom, Heatran, Chandelure, Heatmor, Coalossal, Centiskorch, Dachsbun, Armarouge, Ceruledge.
  - Water (22): Parasect, Poliwrath, Jynx, Lapras, Vaporeon, Politoed, Quagsire, Mantine, Cacturne, Cradily, Gastrodon, Toxicroak, Lumineon, Seismitoad, Maractus, Jellicent, Heliolisk, Araquanid, Dracovish, Arctovish, Tatsugiri, Clodsire.
  - Ground (4): Weezing (+ Galarian), Bronzong, Orthworm. Grass (10): Azumarill, Miltank, Sawsbuck, Bouffalant, Gogoat, Goodra (+ Hisuian), Drampa, Wyrdeer, Farigiraf. Two different immunities, only one possible at a time: Lanturn (Volt Absorb or Water Absorb), Zebstrika (Lightning Rod or Sap Sipper).
  - 19 of the 72 only have it as a hidden ability (Pikachu, Raichu, Azumarill, Typhlosion, Cradily, Seismitoad, ...), so counting them is the most generous reading.
  - Policies to choose from: *conservative* (today: guaranteed only), *optimistic* (assume the player has the immunity ability, as in competitive play), or *curated* (a hand-kept list such as `scripts/overrides/ability-immunities.json` mapping slug to type, with a yes/no per Pokémon after review; the usual signature picks like Vaporeon, Arcanine, Flareon, Jolteon, Weezing). The curated list is the likely next step. Any change needs `npm run build:pokemon`, a calibration rerun and the counts in the docs updated.
  - Also deferred: half-damage abilities (Thick Fat, Heatproof, Fluffy, Filter), Wonder Guard (Shedinja), and an "Immune: Ground" label on pick cards and team squares (hidden in hard mode like types).
- **Era-accurate opponents.** Per-generation type chart and stats for opponents (higher fidelity, more data work).
- **Immunity abilities.** Special-case Levitate, Flash Fire, Volt/Water Absorb and similar as type immunities.
- **Sound.** Original chiptune SFX with a mute toggle, then optional music.
