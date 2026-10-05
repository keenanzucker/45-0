# Simulation calibration

Re-run after changing `DEFAULT_PARAMS`, the pool, or the gauntlet:

```bash
npm run calibrate -- --random 10000 --bst 6000 --bot 300 --best 3
# try other constants without editing code:
npm run calibrate -- --param oppTargetBst=630 --param teamSizeBonus=0.15
```

Options: `--random N` random drafts, `--bst N` BST-picker drafts, `--bot N` greedy expert drafts,
`--best R` hill-climb restarts for the best possible team (0 to skip), `--seed S`, `--param key=value`.

## Targets (SPEC §6.4)

- Random drafts average about 20–25 wins out of 45.
- A good-but-not-expert strategy (BST picker) lands in the mid 30s and goes 45-0 in about 0.1–1% of games.
- A perfect run is reachable.
- Difficulty is even across generations, tiers and opponent team sizes; no type or era dominates.

## Current results (`DEFAULT_PARAMS`)

Measured with two open Legend slots (the former Rare and Legendary slots merged). Compared with the old
layout, random drafts gained about 0.8 wins and the BST picker gained nothing, so the constants were kept.

```
statExponent 0.5, stabWeight 1.5, coverageFloor 0.6, speedWeight 0.25, speedSlope 1,
marginScale 0.5, oppTargetBst 610, championBonus 0.05, teamSizeBonus 0.15
45 fights, 745 playable Pokémon

random drafts (n=20000)      mean 21.8  sd 8.2  p5 8  p50 22  p95 35  max 45   perfect 0.01%
BST picker    (n=2000)       mean 34.1  sd 6.1  p5 23 p50 35  p95 42  max 45   perfect 0.35%
greedy expert (n=300)        mean 39.9  sd 4.5  p5 31 p50 41  p95 45  max 45   perfect 6.0%
best possible team           45-0  (Zacian (Crowned), Heatran, Rotom (Frost), Mega Mewtwo X, Meowscarada, Tyranitar)

random win rate by generation   G1 46%  G2 57%  G3 45%  G4 54%  G5 50%  G6 42%  G7 49%  G8 48%  G9 44%
random win rate by team size    4-mon 45%  5-mon 48%  6-mon 54%
random win rate by tier         e4 46%  gym 51%  champion 54%
top-decile lift (1.0 = as common as overall)
  type      steel 1.37, dragon 1.35, fairy 1.31 ... poison 0.65, normal 0.53, bug 0.53
  era       G9 1.22, G6 1.12, G8 1.10 ... G2 0.92, G1 0.89, G3 0.76
  category  legend 1.57, mega 1.57 ... normal 0.85
```

## How the constants were chosen

- With raw stats (`statExponent` 1), a "highest BST" strategy beat random drafts by about 18 wins even at hard
  difficulty, so BST dominated type coverage. An exponent of 0.5 compresses stat differences relative to type
  effects while keeping 20+ wins between random and expert play.
- Normalizing opponents only by average BST made 6-Pokémon champions far harder (about 10% random win rate) than
  4-Pokémon teams (about 70–90%). `teamSizeBonus` 0.15 equalizes them.
- `oppTargetBst` was swept to center random drafts near 21 wins.
- Greedy expert = the bot knows the exact scoring, so treat it as an upper bound on skill, not a typical player.

## What predicts wins (backs the start-screen tips)

4,000 random drafts on the current data (mean 21.8 wins):

- Average team BST is the strongest single predictor (correlation 0.67).
- Type coverage adds on top of it: among the top third of drafts by BST, teams hitting 16+ of 18 types
  super-effectively averaged 30.8 wins, against 25.6 for teams hitting 14 or fewer.
- Each Legend or Mega on the team is worth about 4 wins: 0 special slots used averaged 16.1 wins, 1 used 20.7,
  2 used 25.0, all 3 used 29.6.
- Shared weaknesses barely matter in the model (best vs. worst defensive third among top-BST drafts: 28.3 vs. 27.4),
  so no tip tells players to avoid them. The weak-spots panel explains losses; it doesn't predict them.
