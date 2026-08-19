# Architecture Overview

How this project is built, how a request turns into a rendered page, where data lives, and how the map/filter UI is shared across pages. Pairs with `docs/SITEMAP.md` (page-by-page route map) — this doc is about the machinery underneath.

---

## 1. Stack at a glance

| Layer | Tool | Role |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Routing, server-side rendering, the only "backend" this project has |
| UI | **React 19** | Components, both server and client |
| Language | **TypeScript** | Everywhere — `.ts`/`.tsx`, no `.js` app code |
| Styling | **Tailwind CSS 4** | Utility classes + a hand-written design-token layer (`app/globals.css`) |
| Database | **Supabase** (managed Postgres) | The one remote datastore, queried via `@supabase/supabase-js` |
| Maps | **Leaflet** + `leaflet.heat` + `leaflet.markercluster` | Every interactive map on the site |
| Hosting | **Vercel** | Zero-config Next.js deployment (no `vercel.json` needed) |
| Auth | **Supabase Auth** (Google OAuth + email/password) | Gates the handful of admin editing affordances — see §3 |
| Misc | `pinyin-pro` (runtime EN-name fallback, also used by one build-time script) | See §10 |

There is no separate backend service. "Backend" here means: React Server Components that call Supabase directly at render time, plus a handful of one-off Node scripts (`scripts/*.js`, `scripts/*.sql`) that are run manually to regenerate static data or reconcile database tables — never invoked by the running app.

---

## 2. Request → page: server vs. client split

This is a standard Next.js **App Router** app, and the split between "runs on the server" and "runs in the browser" is the single most important thing to understand about how data flows.

- **Every `app/**/page.tsx` is a React Server Component (RSC) by default.** It's an `async function` that `await`s data-fetching functions (almost always from `lib/queries.ts`) directly in its body — no `fetch('/api/...')`, because **there is no API layer**. The page component itself *is* the request handler: Vercel runs it server-side for each request (or at build time, where possible), it queries Supabase, and it returns already-rendered HTML plus a serialized prop tree for the interactive parts.
- **Anything with `'use client'` at the top of the file is a Client Component.** These hydrate in the browser and own all interactive state (`useState`, filter toggles, search boxes, Leaflet map instances — Leaflet needs `window`/`document`, so every map component is a client component).
- The handoff is always **server fetches → passes plain data down as props → client component renders/filters it**. For example `app/museum-collections/page.tsx` (server) calls three Supabase-backed functions in parallel, then hands the results to `<AnsMintTownVisualization>` (client), which does all further filtering/rendering in the browser with zero additional network calls (besides Leaflet's own map-tile requests).
- Almost the whole app is still **read-only** this way. The one exception is a small admin editing layer — Server Actions in `lib/admin/*-actions.ts` and two Route Handlers under `app/api/auth/` and `app/auth/callback/` — covered in §3. Bulk/one-off data maintenance (reconciling ANS imports, promoting new coin issues) is still done by hand via the Supabase SQL editor (see `scripts/*.sql`); that part really is out-of-band, not something the running app does.

```
Browser request
     │
     ▼
app/.../page.tsx (Server Component)
     │  await getX(), getY(), getZ()   ← lib/queries.ts, hits Supabase over HTTPS
     ▼
Client Component(s) ('use client')
     │  receives data as props, owns useState for filters/view mode
     ▼
Rendered UI + Leaflet map (browser-only from here on)
```

---

## 3. Admin editing: auth, Server Actions, and the write path

A small, deliberately quiet editing layer sits on top of the otherwise read-only site — not a CMS, just inline Edit/Delete/+Add affordances on `/sites/[site_code]`, `/mints`, `/mints/[mint_code]`, `/coin-types/[slug]`, and `/sources`, for the handful of project collaborators who maintain the data.

**Who gets it, and how that's decided** (`lib/admin/guard.ts`):
- In **dev** (`NODE_ENV !== 'production'`), `isAuthorized()` is always `true` — there's no login flow in dev, editing is just on, matching this project's `npm run dev` workflow.
- In **production**, `isAuthorized()` is true only for a signed-in user whose email is in the `admin_users` table, checked via the `is_admin()` Postgres function (`security definer`, reads `auth.jwt() ->> 'email'`). Every `page.tsx` that offers editing calls `isAuthorized()` once and threads the boolean down as an `isDevMode` prop; components never check auth themselves.

**Signing in** (`lib/auth/actions.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`): Google OAuth (`signInWithOAuth` → redirect → `/auth/callback` exchanges the code for a session) or email/password (`signInWithPassword`), both Supabase Auth. `AuthStatus` (rendered at the bottom of `/about`, nowhere else) shows a quiet "Switch to edit mode" link or, once signed in, "Editing enabled" + Sign out — it fetches `/api/auth/me` client-side rather than making the whole page dynamic just to check a cookie.

**The write path** (`lib/admin/guard.ts`'s `getWriteClient()`):
- **Production:** the caller's own session-scoped client (`lib/supabase/server.ts`) — Postgres Row Level Security, not app code, is the real enforcement boundary. Every editable table has one `admin_write_insert`/`_update`/`_delete` policy gated by `is_admin()` (`scripts/add-admin-write-rls.sql`, run by hand in the Supabase SQL editor — same one-off convention as the rest of `scripts/*.sql`).
- **Dev:** the service-role client (`lib/supabase-admin.ts`, `getSupabaseAdmin()`) if `SUPABASE_SERVICE_ROLE_KEY` is set locally — it bypasses RLS entirely, since dev has no session to be RLS-scoped to. Without that key, dev falls back to a real signed-in admin session if one happens to exist, otherwise throws a setup-instructions error surfaced as a form error (not a raw 500).
- `assertAuthorized()` — a second, redundant check inside every exported Server Action, ahead of any FormData/db work — exists because a Server Action is just a POST endpoint under the hood; a raw POST to a captured action reference must still hit an authorization check, not rely on the UI never rendering the button.

**The actions themselves**, one file per table family, all `'use server'`, all Zod-validated (`lib/admin/schemas.ts`) before touching the database:
- `sites-actions.ts` — update a site; create/update/delete a context or find (free-text period resolved into the `periods` lookup table, insert-then-catch-unique-violation)
- `mints-actions.ts` — update a mint; create a mint (auto-generates a `mint_code` slug, resolves name collisions to the existing row instead of erroring)
- `coin-issues-actions.ts` — update-only (`updateCoinIssue`) — no create/delete for `coin_issues`, deliberately out of scope
- `taxonomy-actions.ts` — quick-create a state/inscription/`coin_type_hierarchy` node (used by `TaxonomyCombobox`'s "+ Add" popups inside the coin-issue edit form), plus editing a hierarchy node's own description
- `sources-actions.ts` / `source-links-actions.ts` — create/update/delete a `sources` row; create/delete a `source_links` citation (admin-created links get a synthetic `SL_ADMIN_<uuid>` code rather than mimicking the business data's numbering scheme)
- `target-search-action.ts` / `target-search.ts` — read-only search-as-you-type for `AddSourceLinkForm`'s target picker (site/context/find/coin_item/mint); routed through a dev-gated `'use server'` wrapper anyway, for one uniform "nothing under `lib/admin` runs unchecked in prod" rule, even though it only ever `SELECT`s

**The UI pattern** (`components/edit/`): `EditableSection.tsx` (panel/card layouts) and the lower-level `useEditableSection` hook it's built on (table rows — see `FindRow.tsx`, `CoinIssueRow.tsx`, which need a real `<tr>`) both render `renderDisplay(data)` plus a small Edit/Delete bar when `isDevMode`, swapping to `renderForm(data)` inside a `<form action={...}>` wired to the relevant Server Action while editing. `TaxonomyCombobox` (options known up front) and `TargetSearchCombobox` (options fetched per keystroke via `target-search-action.ts`, since sites/contexts/finds/coin_items are too large to ship as an option list) cover the two flavors of "pick a related row" the forms need.

None of this introduces an API layer in the REST sense — Server Actions are still just RSC-adjacent function calls Next.js wires up as POSTs — so the "no `fetch('/api/...')` for data" framing in §2 still holds for every *read*. Only mutation gained a real (if small) mechanism.

---

## 4. Where data actually lives

Two clearly separate sources. Getting this distinction right is the key to answering "where does X read from":

### 4a. Remote — Supabase Postgres

Reads go through `lib/supabase.ts` (a single `createClient(...)` instance using the **public anon key** — safe to expose because RLS grants that key `SELECT` only, on public, non-sensitive catalogue data; it has no write policies at all). Every read-side Supabase call in the app lives in one of two files:

- **`lib/queries.ts`** — the main query surface. Tables/views it reads: `sites`, `contexts`, `finds` (joined to `coin_issues`), `coin_issues` (joined to `mints`, `states`, `inscriptions`, `coin_type_hierarchy`), `coin_type_hierarchy`, `mints`, `sources`, `source_links`, and the view **`v_coin_map_sites`** (a flattened, map-ready projection of sites — this is what most map pages actually query instead of the raw `sites` table).
- **`lib/ans-museum-data.ts`** — one function, `getAnsSpecimens()`, reading the **`ans_data`** table (joined to `mints`/`states`), which backs the Museum Collections page.

Both files are imported **only from `page.tsx` files** (server components) — never from a `'use client'` file — so the actual query execution always happens server-side even though the anon key itself is public. Writes are a separate story: `lib/admin/*-actions.ts` (Server Actions) go through `lib/admin/guard.ts`'s `getWriteClient()` instead — either a session-scoped client that RLS gates by `is_admin()`, or (dev only) the service-role client in `lib/supabase-admin.ts` — never `lib/supabase.ts`. See §3.

Supabase's PostgREST API caps a single response at 1000 rows. `queries.ts` exports a `fetchAllPages()` helper that every multi-row query uses to page through `.range()` until it gets a short page back — several tables here (`sites`, `finds`, `contexts`) exceed 1000 rows, so without this, results would silently truncate.

The core find-provenance chain is `sites` → `contexts` (an archaeological findspot within a site — a tomb, hoard pit, stratum) → `finds` (a reported coin group from one context, per one source — quantity fields like `quantity_total`/`quantity_min`/`quantity_estimated` live here) → `coin_items` (individually catalogued specimens within a find, with their own measurements/condition/photos). Every quantity shown in the UI still comes from the `finds`-level quantity fields directly (see `getFindsForHeatmap` in `lib/queries.ts` and `computeSiteHeatStates` in `lib/context-heatmap.ts`), not from counting `coin_items` rows — most finds have quantities but no itemized `coin_items` at all. `coin_items` itself is now touched in exactly one narrow place: `lib/admin/target-search.ts`'s search-as-you-type lookup for `/sources`' "attach a citation to a coin item" picker — it's still not browsable or displayed as its own record anywhere.

`source_links` — a generic polymorphic join table (`source_code` × `target_type`/`target_code`, `target_type` one of `site`/`context`/`find`/`coin_item`/`mint`) — used to be unused; it now backs the `/sources` page and the site/mint "Sources & Citations" panels end-to-end: read via `getAllSourceLinks()` (all links, for `/sources`), `getSourceLinksForSite()`/`getSourceLinksForMint()` (scoped, for the detail pages), resolved to a display target via `lib/admin/resolve-source-link-target.ts`, written via `lib/admin/source-links-actions.ts`.

Two tables still aren't read by the running app at all:
- `ans_data_upload` (raw import staging) — reconciled by hand into `ans_data` via `scripts/reconcile-ans-data.sql`, run in the Supabase SQL editor whenever new ANS catalogue data comes in. `scripts/append-new-coin-issues.sql` is the same kind of manual, one-off tool.
- `admin_users` (collaborator email allow-list, see §3) — never queried directly by the app; only read indirectly through the `is_admin()` `security definer` function, which runs with elevated privilege regardless of the caller's own RLS grants.

### 4b. Local — bundled into the repo

Data that either never changes, is small enough to just ship, or is derived once from a source document and checked in as generated code:

| What | Where | Source |
|---|---|---|
| Mint town static dossiers (coordinates, descriptions, images, citations) | `lib/mint-towns.ts` + `lib/mint-dossiers.ts` (`MINT_TOWNS` / `MINT_DOSSIERS`) | Hand-transcribed from `铸币城邑考证61.docx` |
| River overlays for the map base layers | `public/data/rivers-major.geojson`, `rivers-minor.geojson` | `scripts/clip-rivers-to-china.js`, clipped from Natural Earth 1:10m data |
| Mint-town photos, coin specimen photography | `public/images/mints/`, `public/images/type_imgs/` | Static files, matched by filename prefix at request time (`lib/coin-images.ts`) |

Map **tiles** and **city/county boundary polygons** are the one runtime "external" dependency that isn't Supabase: base tiles come from OpenStreetMap / CyclOSM, Esri ArcGIS (satellite + English labels), the Consortium of Ancient World Mappers terrain, and 高德 / AutoNavi (`lib/map-layers.ts`), and precise city/county boundary outlines are fetched live from Nominatim (`lib/city-boundaries.ts`), cached in-memory per session.

**Rule of thumb:** if it's about a specific archaeological find, coin issue, or museum specimen, it's in Supabase. If it's reference/gazetteer data (which mint is where, what the typology tree looks like) or media, it's local.

---

## 5. `lib/` tour

Grouped by job rather than alphabetically:

**Data access — reads**
- `supabase.ts` — the anon read client (only place outside `lib/supabase/` and `lib/supabase-admin.ts` that `createClient` is called)
- `queries.ts` — nearly every Supabase query in the app; also owns `fetchAllPages`, the flatten-a-joined-row helpers (e.g. `flattenCoinIssue`), and derived aggregate queries like `getMintFindspotsData`
- `ans-museum-data.ts` — the one `ans_data` query (kept separate from `queries.ts` since it's a different table family, feeding Museum Collections specifically)

**Data access — writes & auth** (see §3 for the full picture)
- `supabase/server.ts` — `createServerSupabaseClient()`, the cookie-aware session-scoped client used for auth and (in production) admin writes
- `supabase/proxy.ts` — `updateSession()`, called from the root `proxy.ts` on every request to keep the auth cookie fresh
- `supabase-admin.ts` — `getSupabaseAdmin()`, the lazily-built service-role client; dev-only, RLS-bypassing, never imported outside `lib/admin/guard.ts`
- `admin/guard.ts` — `isAuthorized()`, `assertAuthorized()`, `getWriteClient()` — the single chokepoint every admin Server Action goes through
- `admin/*-actions.ts` (`sites-actions.ts`, `mints-actions.ts`, `coin-issues-actions.ts`, `taxonomy-actions.ts`, `sources-actions.ts`, `source-links-actions.ts`) — the Server Actions themselves, one file per table family
- `admin/schemas.ts` — the Zod schemas every action validates `FormData` against before writing
- `admin/target-search.ts` / `target-search-action.ts` — search-as-you-type for `AddSourceLinkForm`'s citation-target picker
- `admin/resolve-source-link-target.ts` — turns a `source_links` row's `target_type`/`target_code` into a display label + href
- `auth/actions.ts` — `signInWithGoogle`, `signInWithPassword`, `signOut` (Server Actions backing `/login` and `AuthStatus`)
- `auth/session.ts` — `getCurrentUserEmail()`, backing `/api/auth/me`

**Types**
- `types.ts` — the DB-shaped types (`MapSite`, `Site`, `Context`, `CoinIssueDisplay`, `Find`, `Source`, `HeatmapFind`, …), i.e. what `queries.ts` returns

**Static reference data**
- `mint-towns.ts` / `mint-dossiers.ts` — `MINT_TOWNS` and lookups (`getMintByNameZh`, `resolveMintNameZh` for name-alias handling)
- `mint-directory.ts` — merges a live `mints` DB row with its matching static dossier (DB wins per-field where it has data)
- `coin-images.ts` — filename-prefix matching for specimen photos

**Domain logic / aggregation** (the "how do these rows turn into map points" layer)
- `pointed-spade-data.ts` — mint-town aggregation from database `finds` (`computeMintStatsFromFinds`), from ANS specimens (`computeAnsMintStats`/`computeAnsMintTypeQuantities`), and the shared `AnsSpecimen` type + `toMintPoints()` reshaper
- `mint-filter.ts` — Find Site's "filter by mint" support: option list building (with per-mint find-site counts), matching selected mints against `coin_issues_id`, and `computeSiteMintQuantities` for Compare view
- `typology-filter.ts` — the coin-type hierarchy filter: matching logic (`coinMatchesTypologyFilter`) plus the level-by-level dropdown option builders used by `TypologyFilterBar`
- `context-heatmap.ts` — the core "how matched is this site" math: per-context → per-site heat-state aggregation, shared by every points/density map
- `coin-type-catalog.ts` — builds the `/coin-types` browsing tree + counts
- `city-boundaries.ts` — precision classification (site/county/city) and live boundary-polygon fetches

**Presentation helpers**
- `color-scale.ts` — the match-ratio color ramp, the density heatmap gradient, `NO_DATA`/`SINGLE_FIND`/`PRESENT_UNQUANTIFIED` status colors, and `SELECTION_COLORS` (the fixed 8-hue identity palette for multiselect pins/Compare view) plus the hook that assigns/keeps stable color slots per selection
- `format.ts`, `name-translation.ts`, `state-colors.ts` — small display-formatting utilities (numbers, EN name fallback via `pinyin-pro`, per-state tag colors)
- `map-layers.ts` — shared Leaflet base-layer (OSM/satellite) and river-overlay setup
- `search-filters.ts` — facet building/sorting for `/search`

**i18n**
- `i18n/dictionary.ts` — the flat `{ key: { en, zh } }` string table (every piece of UI copy lives here, nothing hardcoded in components)
- `i18n/LanguageContext.tsx` — client-side language state (persisted to `localStorage`), the `t()` translate function, and the `useLanguage()` hook

---

## 6. `components/` tour — and how the map pages actually reuse code

### The "pure map" pattern

Most single-purpose maps (`components/map/CoinMap.tsx`, `CoinFilterMap.tsx`, `HoardMintOriginsMap.tsx`, `MintIssueDistributionMapCanvas.tsx`, `SinglePointMap.tsx`) follow the same shape: a `'use client'` component that owns a Leaflet instance in a `useRef`, takes already-computed data as props, and renders markers/popups — **no filter state, no caption, no page chrome**. The page (or a thin owning component) fetches data, computes what to show, and wraps the pure map with whatever UI it needs. This keeps each map trivially reusable: `CoinMapSection.tsx`, for instance, is just a thin default-props wrapper around `CoinMap.tsx`, used by both `/search` and `/sites/[site_code]`.

### The shared engine: `MapVisCanvas.tsx`

This is the one map component that isn't single-purpose — it's the canvas behind **Find Site**, **Mint Town** (database), and **Museum Collections** (Mint Town view) simultaneously. It takes a discriminated-union prop (`kind: 'sites' | 'mints'`) and layers up to three independent marker sets on the same Leaflet map:

1. **Heat-state dots** — the main points, colored by match ratio (`stateColor()`) or as a density heat layer, sized by quantity (`siteSizeByQuantity`). This logic is identical whether a "point" represents an archaeological site or a mint town.
2. **`PinPoint`** — user-selected dropped pins (fully opaque teardrop markers), used for a selected mint's own location (Find Site) and for selected specimens in Museum Collections' search. Pins that land on the exact same coordinate are auto-jittered apart (`stackOffset`) so multiple selections stay visible.
3. **`ComparePoint`** — Find Site's Compare view only: one point per (site, mint) pair, colored by mint identity instead of ratio, so a site with coins from two selected mints renders as two separate points.

One canvas, three call sites, because "how a marker gets drawn, sized, colored, and reconciled across re-renders" is genuinely the same problem in all three places — only *what the data means* differs, and that's decided by the caller.

### The shared orchestrator: `MapVisualization.tsx`

This single file exports **three sibling components** — `FindSpotsVisualization`, `MintTownVisualization`, and `AnsMintTownVisualization` (Museum Collections) — because they share nearly everything *except* their data source and aggregation math:

| Shared piece (same file, reused as-is) | Differs per component |
|---|---|
| `ToggleButtons`, `ViewModeRow` (Points/Density/Compare toggle) | Which `viewMode`s are offered (Compare only for Find Site's mint filter) |
| `MapExplanation` — **one shared string per view mode** ("how to read this map"), identical wording everywhere it appears | — (this is the point: no per-page duplicate copy) |
| `DensityLegend`, `CompareLegend` | Legend contents (mint colors vs. ratio stops) |
| `MapVisualizationOverlay` / `MuseumMapOverlay` (floating filter-panel shell, collapsible on mobile) | The filter controls rendered inside it |
| `TypologyFilterBar` (coin-type hierarchy picker) | — shared verbatim by all three |
| `heatIntensity()` (density weighting curve) | — shared verbatim |

Each component supplies its own **data → map-points pipeline**: `FindSpotsVisualization` calls `computeSiteHeatStates` (per find-site), `MintTownVisualization` calls `computeMintStatsFromFinds` (database finds aggregated per mint), `AnsMintTownVisualization` calls `computeAnsMintStats` (ANS specimens aggregated per mint) — then each renders `<MapVisCanvas kind="sites">` or `<MapVisCanvas kind="mints">` with its own results. This is the "object-oriented" structure the map pages share: one shell, one canvas, swappable aggregation.

### Search: two variants of one pattern

- `components/ui/MultiSelectSearch.tsx` — a **generic** multiselect combobox (search box + always-visible scrollable checkbox list + selected-chip row + Clear button). Used by Find Site's mint filter.
- `components/museum/AccessionNumberSearch.tsx` — the **bespoke** Museum Collections version of the same interaction pattern (same chips/Clear/checkbox structure), kept separate because each result row needs richer content (inscription, mint link, state, an external ANS-catalogue link, "unmapped" graying) than a generic option list supports.

Both feed the same downstream mechanism: a `selectedOrder: string[]` + a stable color-slot map (`lib/color-scale.ts`) that the parent turns into `PinPoint[]`/`ComparePoint[]` for `MapVisCanvas`.

### Everything else, briefly

- `components/mints/*` — the `/mints` and `/mints/[mint_code]` page pieces (list, image gallery, issue-distribution filter, plus the dev-only `AddMintSection`/`MintRecordSection` edit pieces)
- `components/coin-types/*` — the `/coin-types` typology browser (tree, cards, mould tags), plus `CoinTypeDescriptionSection` and the `CoinIssuesTable` → `CoinIssueRow` (+ `*QuickCreateForm`) edit pieces on `/coin-types/[slug]`
- `components/site/*` — `/sites/[site_code]`'s tabbed detail view + pie chart, plus the editable `SiteRecordSection`/`ContextCard`/`FindRow`
- `components/sources/*` — `/sources` and the site/mint "Sources & Citations" panels (`SourceCard`, `CitationsSection`, `AddSourceLinkForm`, `SourcesListClient`)
- `components/auth/*` — `LoginForm` (`/login`) and `AuthStatus` (the sign-in status strip on `/about`)
- `components/edit/*` — the generic editing kit every admin form is built from: `EditableSection`/`useEditableSection` (display ⇄ form toggle wired to a Server Action), `TaxonomyCombobox`/`TargetSearchCombobox` (the two "pick a related row" patterns), `ConfirmDeleteButton`, `ActionFormStatus`, `FieldRow`, `Modal`
- `components/search/*` — `/search`'s filter sidebar, result cards, sort control
- `components/home/*` — homepage hero banner + nav cards
- `components/layout/*` — header, mobile nav, footer (`ConditionalFooter` hides the footer on full-bleed map pages)
- `components/ui/*` — small generic primitives (`DataCard`, `Pagination`, `Tabs`, `CopyButton`, …)

---

## 7. The type system

Two layers, deliberately kept separate:

1. **DB-shaped types** (`lib/types.ts`) mirror what Supabase returns after `queries.ts` flattens a joined row — `MapSite`, `CoinIssueDisplay`, `Find`, `HeatmapFind`, etc. These are the types that cross the server → client boundary as props.
2. **Rendering-shaped types**, defined next to the component that consumes them and imported *back* into the `lib/` functions that produce them — a deliberate small inversion so "the shape a map needs" is defined once, at the map:
   - `MintPoint`, `PinPoint`, `ComparePoint` — exported from `components/map/MapVisCanvas.tsx`; `lib/pointed-spade-data.ts`'s `toMintPoints()` imports `MintPoint` just to type its return value.
   - `AnsSpecimen`, `PointedSpadeMintStat`, `HeatmapSource` — exported from `lib/pointed-spade-data.ts`.
   - `MintFilterOption` (`lib/mint-filter.ts`), `TypologyFilterSelection` (`lib/typology-filter.ts`), `SiteHeatState` / `ContextHeatState` / `FilterMode` / `ViewMode` (`lib/context-heatmap.ts`).

Component prop types are plain inline `{ ... }` object types in nearly every file (this codebase doesn't use a shared `Props` type convention) — the exported types above are exported specifically *because* something else needs to import them, not as a blanket rule.

The admin editing layer (§3) adds one small convention of its own: every Server Action returns `ActionState<T>` (`lib/admin/types.ts`) — `{ ok: true, data: T, message?: string }` or `{ ok: false, formError?: string, fieldErrors?: ... }` — which `useEditableSection`/`EditableSection` and the various `useActionState` calls in `components/auth`/`components/sources` are all written against generically.

---

## 8. Internationalization (EN/ZH)

Every string in the UI is a lookup, never a hardcoded literal: `<T k="museum.search.hint" />` or `t('map.currentView.typeNone', { count })`, resolved against `lib/i18n/dictionary.ts`'s flat table of `{ en, zh }` pairs (with `{var}` interpolation). `LanguageProvider` (wrapping the whole app in `app/layout.tsx`) holds the current language in React context, defaults to English for SSR-safety, then corrects to whatever's in `localStorage` right after mount. There's no locale-based routing (no `/zh/...` URLs) — it's a single client-side toggle (`components/i18n/LanguageToggle.tsx`) that re-renders the same page in the other language.

---

## 9. Styling

Tailwind CSS 4, configured CSS-first (no `tailwind.config.js` — `@import "tailwindcss"` at the top of `app/globals.css`). On top of Tailwind's utilities, `globals.css` defines a small hand-written design-token system (color palette as CSS custom properties, card/panel/button primitives) so the whole site's look can be retinted from one place. `app/maps.css` is `@import`ed separately and holds every Leaflet marker-dot class (`.map-dot`, `.map-dot-size-N`, role classes) — kept apart from Tailwind because marker HTML is built as raw strings in JS (`L.divIcon({ html: ... })`), not JSX, so it needs real CSS classes rather than utility classes.

---

## 10. Third-party modules — what's used, for what

| Module | Used for |
|---|---|
| `leaflet` | The map engine itself — every interactive map on the site |
| `leaflet.heat` | Density-view heat layers (`MapVisCanvas`'s Density mode, the homepage's always-on density overlay) |
| `leaflet.markercluster` | Marker clustering on `CoinMap.tsx` (search results / site-detail maps, which can have many nearby points) and on `MapVisCanvas.tsx` (Find Site / Mint Town overview markers cluster at national zoom, then uncluster once a type/mint filter narrows the point set) |
| `@supabase/supabase-js` | The read-side Postgres client (`lib/supabase.ts`) and the dev-only service-role write client (`lib/supabase-admin.ts`) |
| `@supabase/ssr` | Cookie-aware session clients for auth (`lib/supabase/server.ts`, `lib/supabase/proxy.ts`) — separate from the plain `@supabase/supabase-js` client above, since the anon/service-role clients don't handle browser cookies |
| `pinyin-pro` | Runtime fallback: generates a romanized English name from Chinese when no curated translation exists (`lib/name-translation.ts`); also used dev-only by `scripts/gen-technical-terms.js` |

No charting/dataviz library is used — the pie chart on site pages (`components/site/CoinTypePieChart.tsx`) is hand-rolled SVG, and every "chart-like" visualization on this site is actually the Leaflet map itself (points/density/compare), styled per the project's own `dataviz`-skill-validated color rules (see `lib/color-scale.ts`'s `SELECTION_COLORS` comment).

---

## 11. Data pipeline (offline, not part of the running app)

These never run automatically — they're one-off or occasional maintenance steps:

- `scripts/gen-technical-terms.js` — glossary generation
- `scripts/clip-rivers-to-china.js` — Natural Earth river data → the two river GeoJSON files
- `scripts/reconcile-ans-data.sql` — rebuilds `public.ans_data` from `public.ans_data_upload` in Supabase (run by hand in the SQL editor)
- `scripts/append-new-coin-issues.sql` — promotes unresolved `ans_data` rows into new `coin_issues` records
- `scripts/add-admin-write-rls.sql` — one-time setup for the admin editing layer (§3): creates `admin_users` and `is_admin()`, adds the `admin_write_insert`/`_update`/`_delete` RLS policies to every editable table. Run once by hand; adding a new collaborator afterward is a single manual `insert into admin_users`.

---

## 12. Deployment

Vercel, deploying this Next.js App Router project with no custom configuration (`next.config.ts` is essentially empty; no `vercel.json`). Required environment variables (set in the Vercel project, and locally in `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (local admin writes only — Add citation / edit forms; never ship to the browser)
- `GOOGLE_SHEET_MINTS_CSV_URL` (optional — `/mints` falls back to the static `MINT_TOWNS` list without it)

No new env var is needed for admin editing in production — Google OAuth is configured on the Supabase project itself (Auth → Providers), and who's allowed to write is data (`admin_users` rows, §3), not config.

Most pages render per-request (dynamic Server Components hitting Supabase live); `/mints` opts into ISR (`export const revalidate = 3600`) since its Google Sheets source changes rarely. There are no serverless/edge functions beyond what Next.js's own RSC rendering provides — the whole "backend" is those server components plus Supabase.

**Local dev note:** this Next.js version requires Node ≥ 20 (the repo's default `nvm` Node may be older — check before running `npm run dev`).

---

## 13. Worked example: loading `/museum-collections`

Ties the whole pipeline together:

1. Request hits `app/museum-collections/page.tsx` (Server Component).
2. It runs `Promise.all([getAnsSpecimens(), getCoinIssues(), getCoinTypeHierarchy()])` — three parallel Supabase queries (`lib/ans-museum-data.ts`, `lib/queries.ts`), each paging through `fetchAllPages` if needed.
3. Results (plain serializable objects, typed as `AnsSpecimen[]`, `CoinIssueDisplay[]`, `CoinTypeHierarchyRow[]`) are passed as props into `<AnsMintTownVisualization>`.
4. From here it's all client-side: `AnsMintTownVisualization` (in `components/visualizations/MapVisualization.tsx`) computes mint aggregates (`computeAnsMintStats`, `lib/pointed-spade-data.ts`), builds `MintPoint[]` for the base map and `PinPoint[]` for any selected search results, and renders `<MapVisCanvas kind="mints">` plus the shared filter-panel shell (`MuseumMapOverlay`, `TypologyFilterBar`, `MapExplanation`) and `<AccessionNumberSearch>`.
5. Every further interaction — switching Points/Density, picking a coin type, searching an accession number, selecting specimens — is pure in-browser state and re-render. No additional network round-trip happens until the user navigates to a different page (or Leaflet requests another map tile).
