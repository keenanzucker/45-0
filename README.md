# 45-0

Build an elite team of six Pokémon (spin an era and a type for each pick), then see what record it posts against
every generation's Elite Four and Champion (45 fights). Live at [45-0.com](https://45-0.com). Fully static: no backend.

The full design is in [`SPEC.md`](SPEC.md); simulation calibration is in [`docs/calibration.md`](docs/calibration.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit + component tests
npm run build        # type-check and production build
```

Add `?debug` to the URL (for example `http://localhost:5173/?debug`) to log how every fight was decided to the browser
console when a results screen shows.

## Deploy

A static Vite app, deployed on Vercel from the `main` branch:

- Framework preset **Vite**, install `npm ci`, build `npm run build`, output `dist` (Vercel detects these).
- Node 20.19 or newer (`.nvmrc` says 22).
- Share links use `https://45-0.com`; set `VITE_SITE_URL` to change that. `npm run dev` points them at localhost
  (`.env.development`).
- `vercel.json` only sets cache headers for the sprite and trainer images; the app has no routes to rewrite.
- The data files and images in `public/` are generated and checked in, so a deploy needs no pipeline run.

## Data pipeline

The app reads two checked-in files, `public/data/pokemon.json` and `public/data/gauntlet.json`, plus sprites in
`public/sprites/`. Regenerate them only when the source data changes:

```bash
npm run build:pokemon    # PokeAPI -> pokemon.json + sprites (responses cached in .cache/)
npm run build:gauntlet   # PokémonDB + DittoBase -> gauntlet.json (report in .cache/gauntlet-report.txt)
npm run calibrate        # simulation difficulty report (see docs/calibration.md)
```

Manual corrections live in `scripts/overrides/`.

## Layout

- `src/engine/`: pure game logic (spins, slots, reducer, battle simulation), no React.
- `src/results/`, `src/state/`, `src/ui/`: titles and share text, local storage, list sorting.
- `src/components/`, `src/screens/`: the Nintendo DS-style interface.
- `scripts/`: data pipeline and calibration tooling.

Unofficial fan project. Not affiliated with or endorsed by Nintendo, Game Freak, Creatures or The Pokémon Company.
Pokémon and related names, sprites and trainer images are trademarks and property of their owners. Non-commercial.
Data from [PokéAPI](https://pokeapi.co), [PokémonDB](https://pokemondb.net) and [DittoBase](https://www.dittobase.com).
