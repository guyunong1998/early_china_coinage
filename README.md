# Early Chinese Coin Finds Database

A searchable, mapped record of pre-Qin to early Han coin discoveries across China — archaeological sites, excavation contexts, individual finds, coin typology, mint towns, and museum specimens, presented in both English and Chinese.

Live pieces at a glance:

- **Search** every recorded find site by region, period, site type, coin type, state, mint, or quantity.
- **Map Visualizations** for Find Site and Mint Town data, each with Points / Density / Compare display modes.
- A full **Coin Types** typology browser (钱币/Coin and 钱范/Mould hierarchies) and a **Mints** directory of coin-producing towns.
- **Museum Collections** — reconciled ANS (American Numismatic Society) specimens shown the same way as the database's own mint data.

## Getting started

This project requires **Node ≥ 20** (a system default of Node 18 via `nvm` cannot run `next dev` on Next.js 16 — switch versions first, e.g. `nvm use 20`).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required environment variables (`.env.local`, see that file for the current template):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_SHEET_MINTS_CSV_URL` (optional — `/mints` falls back to the static local mint dossier list without it)

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/SITEMAP.md`](docs/SITEMAP.md) | Every route, what visitors see there, and — for each page — which components and `lib/` data functions it's built from. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The stack, the server/client split, where data actually lives (Supabase vs. local files), the shared map-rendering engine, i18n, styling, and deployment. Start here to understand how the app is put together. |
| [`docs/DATA_VISUALIZATION_CALCULATIONS.md`](docs/DATA_VISUALIZATION_CALCULATIONS.md) | The exact math behind every map's point size and color (Points/Density/Compare modes) — the "what number produces what pixel" reference. |


## Stack

Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS 4, Supabase (Postgres) as the one remote datastore, and Leaflet for every interactive map. No separate backend or API layer — server components query Supabase directly at render time. See `docs/ARCHITECTURE.md` for the full picture.

## Data

Two sources, kept deliberately separate — see §3 of `docs/ARCHITECTURE.md` for the full rule:

- **Supabase (remote)**: anything about a specific archaeological find, coin issue, or museum specimen — queried through `lib/queries.ts` and `lib/ans-museum-data.ts`.
- **Local (bundled in the repo)**: reference/gazetteer data that rarely changes (mint town dossiers in `lib/mint-towns.ts` / `lib/mint-dossiers.ts`, river overlays, specimen photography) — used as a fallback or supplement wherever the database doesn't carry a field yet.

## Deployment

Deployed on Vercel with no custom configuration. Most pages render per-request; `/mints` uses ISR (`revalidate = 3600`).
