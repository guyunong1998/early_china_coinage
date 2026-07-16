# Site Map

Early Chinese Coin Finds Database — pre-Qin to early Han coin discoveries: sites, contexts, typology, and geographic distribution.

---

## For Visitors

| Page | What you'll find there |
|---|---|
| **Home** (`/`) | Hero banner with sitewide stats and a search box, quick-nav cards, and an interactive map of every find site. |
| **Search** (`/search`) | Full-text search over sites, with filters (region, period, site type, coin type, state, mint, quantity) and a results map. |
| **Site record** (`/sites/[site_code]`) | One archaeological site's full record: location, coin types found, excavation contexts, individual finds, mint origins, and bibliographic sources. |
| **Mints** (`/mints`) | Every documented mint town, with an overview map and a searchable list. |
| **Mint record** (`/mints/[mint_code]`) | One mint town's profile: photos, location, and the coin finds/sites its issues have been recovered from. |
| **Map Visualizations** (`/visualizations`) | Three ways to explore find sites on a map — **Quantity** (mint production heatmap), **Coin Type** (filter by typology), and **Mint** (filter by mint). Landing on `/visualizations` itself drops you into a random one of the three. |
| **Heatmap** (`/heatmap`) | Standalone mint-town production heatmap (database finds vs. the ANS pointed-foot/square-foot spade catalogues), with a coins-by-mint table and data-source notes. |
| **About** (`/about`) | Project scope, team, and collaborations. |

Retired routes `/map` and `/coin-types` no longer exist (they used to redirect into Map Visualizations; both were removed once nothing linked to them).

---

## For Development

Conventions below: **Route** is the URL, **File** is the page component, **Components** are the non-shared pieces it renders (shared layout is listed once at the bottom), **Libs/data** are the non-React modules and data sources it reads from, and **What it does** is a short description of the page's behavior.

### `/` — Home

- **File:** `app/page.tsx`
- **What it does:** Server component. Fetches all mapped sites and renders the hero banner, nav cards, and the homepage map widget under a "View More Map Visualizations" header linking to `/visualizations`.
- **Components:** `components/home/HeroBanner.tsx` (stats + search box + `hero-coins.svg` gradient overlay), `components/home/NavCards.tsx`, `components/map/CoinFilterMap.tsx` (pure map — clickable site markers + default density heat layer), `components/ui/SearchForm.tsx` (used inside HeroBanner), `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getMapSites`, `getDatabaseStats` — Supabase), `lib/format.ts`, `app/maps.css` (marker dot classes), `app/globals.css` (`--hero-gradient-*`, `.panel-header`/`.panel-body`)

### `/about` — About

- **File:** `app/about/page.tsx`
- **What it does:** Static content page (project scope, team, collaborations) built from three `DataCard` panels.
- **Components:** `components/ui/DataCard.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/i18n/dictionary.ts` (all copy is translation keys, no DB access)

### `/search` — Search

- **File:** `app/search/page.tsx`
- **What it does:** Server component. Parses filters from the query string, runs a full-text or filtered site query, computes facet counts, sorts/paginates results, and renders a results map + list with a collapsible filter sidebar (collapsed by default below 1440px).
- **Components:** `components/search/SearchFilters.tsx`, `components/search/SearchFiltersToggle.tsx`, `components/search/SearchResultCard.tsx`, `components/search/SearchableCheckboxList.tsx`, `components/search/SortSelect.tsx`, `components/map/CoinMapSection.tsx` → `components/map/CoinMap.tsx`, `components/site/CoinTypePieChart.tsx`, `components/ui/Pagination.tsx`, `components/i18n/T.tsx` / `TranslatedInput.tsx`
- **Libs/data:** `lib/queries.ts` (`searchSites`, `getAllSites`, `getCoinTypes`, `getFindsForHeatmap`), `lib/search-filters.ts` (facet building, sorting), `lib/city-boundaries.ts` (precision filter), `lib/format.ts`, `lib/name-translation.ts`

### `/sites/[site_code]` — Site record

- **File:** `app/sites/[site_code]/page.tsx`
- **What it does:** Server component. Loads one site plus its contexts, finds, sources, and mint origins; 404s via `notFound()` if the code doesn't exist. Renders location/info cards, a mint-origins map, and a tabbed breakdown of contexts/finds/references.
- **Components:** `components/map/CoinMapSection.tsx`, `components/map/HoardMintOriginsMap.tsx` (pure map), `components/site/SiteDetailTabs.tsx` (uses `components/site/CoinTypePieChart.tsx`), `components/ui/DataCard.tsx`, `components/ui/CopyButton.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getSite`, `getSiteMapSummary`, `getSiteContexts`, `getSiteFinds`, `getSources`), `lib/mint-towns.ts` (`getMintByNameZh`), `lib/format.ts`

### `/mints` — Mints overview

- **File:** `app/mints/page.tsx`
- **What it does:** Server component, revalidates hourly. Loads the mint town list from a Google Sheet (falling back to a local static file on error), then renders an overview map plus a searchable/filterable list.
- **Components:** `components/mints/MintListClient.tsx`, `components/map/MintsOverviewMap.tsx` (pure map), `components/i18n/T.tsx`
- **Libs/data:** `lib/sheets.ts` (`fetchMintsFromSheet` — Google Sheets API), `lib/mint-towns.ts` (`MINT_TOWNS` static fallback)

### `/mints/[mint_code]` — Mint record

- **File:** `app/mints/[mint_code]/page.tsx`
- **What it does:** Server component. Loads one mint's dossier (photos, notes) and its issued-coin findspot data; 404s if the mint code isn't recognized. Renders the mint's own location, image gallery, and an issued-coin distribution section with a coin-type filter.
- **Components:** `components/mints/MintIssueDistribution.tsx` (owns the coin-type filter state; renders `components/map/MintIssueDistributionMapCanvas.tsx`, a pure map), `components/mints/MintImageGallery.tsx`, `components/mints/MintPlaceholder.tsx`, `components/map/SinglePointMap.tsx` (pure map, the mint's own location), `components/i18n/T.tsx`
- **Libs/data:** `lib/mint-dossiers.ts` (`getMintDossierByCode`), `lib/mint-towns.ts` (`getMintByCode`), `lib/queries.ts` (`getMintFindspotsData`)

### `/visualizations` — Random tab redirect

- **File:** `app/visualizations/page.tsx`
- **What it does:** No UI — `export const dynamic = 'force-dynamic'`, then `redirect()`s to a randomly-chosen one of `/visualizations/{quantity,coin-type,mint}` on every request.
- **Components:** none
- **Libs/data:** none (just `next/navigation`)

### `/visualizations/quantity` — Quantity tab

- **File:** `app/visualizations/quantity/page.tsx`
- **What it does:** Server component. Fetches database + ANS (pointed/square-foot) mint stats and renders the sidebar ("Visualize by" tabs + Data toggle) alongside the mint production heatmap map only — no title, no bordered container, no table (unlike `/heatmap`, which shares the same underlying map component but keeps all of that).
- **Components:** `components/visualizations/QuantityVisualization.tsx` (owns source/ANS-kind state) → `components/map/PointedSpadeHeatmap.tsx` (pure map), `components/visualizations/VisualizationTabs.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/pointed-spade-data.ts` (`getPointedSpadeMintStats`, plus the shared `HeatmapSource`/`AnsSpadeKind` types), `lib/ans-spade-data.ts` (`getAnsPointedSpadeMintStats`, `getAnsSquareSpadeMintStats` — reads `public/data/ans-pointed-spade.json` / `ans-square-spade.json`)

### `/visualizations/coin-type` and `/visualizations/mint`

- **Files:** `app/visualizations/coin-type/page.tsx`, `app/visualizations/mint/page.tsx` (near-identical; differ only in `forcedMode`)
- **What it does:** Server component. Fetches find sites + coin types + finds, filters by location-precision query param, and renders the precision-tabs header plus the shared find-spots visualization, locked to filtering by coin type or by mint respectively.
- **Components:** `components/visualizations/FindSpotsVisualization.tsx` (owns all filter/view-mode state) → `components/visualizations/FindSpotsSidebar.tsx` (renders `components/visualizations/TypologyFilterBar.tsx` and `components/visualizations/VisualizationTabs.tsx`) + `components/map/FindSpotsMapCanvas.tsx` (pure map), `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getFindSpotsMapSites`, `getCoinTypes`, `getFindsForHeatmap`), `lib/city-boundaries.ts` (precision filter/counts), `lib/context-heatmap.ts` (`computeSiteHeatStates`, `FilterMode`/`ViewMode` types), `lib/mint-filter.ts`, `lib/typology-filter.ts`, `lib/color-scale.ts` (match-ratio color gradient)

### `/heatmap` — Standalone heatmap (kept deliberately separate — see below)

- **File:** `app/heatmap/page.tsx`
- **What it does:** Server component. Fetches the same database + ANS mint stats as the Quantity tab, but renders the full `HeatmapPanel` — dataset toggle, the heatmap map, a "Coins by mint" table, and a "Data sources" card.
- **Components:** `components/heatmap/HeatmapPanel.tsx` → `components/map/PointedSpadeHeatmap.tsx` (pure map, shared with the Quantity tab), `components/ui/DataCard.tsx`
- **Libs/data:** same as `/visualizations/quantity` (`lib/pointed-spade-data.ts`, `lib/ans-spade-data.ts`), plus `lib/format.ts`
- **Note:** intentionally *not* deduplicated with `/visualizations/quantity` — they share the same pure map component but each owns its own page-level chrome, by design.

---

### Shared across every page (not repeated above)

- **Root layout:** `app/layout.tsx` — loads fonts (Geist, Playfair, Spectral via `next/font/google`; LXGW WenKai TC via `lxgw-wenkai-tc-webfont` for CJK glyph fallback), wraps everything in `lib/i18n/LanguageContext.tsx` (`LanguageProvider`), renders `components/layout/SiteHeader.tsx` and `components/layout/ConditionalFooter.tsx`, sets the `/coin.svg` favicon.
- **Header/nav:** `components/layout/SiteHeader.tsx` (desktop nav, `lg:` and up) + `components/layout/MobileNav.tsx` (hamburger dropdown, below `lg:`) + `components/i18n/LanguageToggle.tsx`.
- **Footer:** `components/layout/SiteFooter.tsx`, hidden on the full-viewport map pages (`/visualizations/coin-type`, `/visualizations/mint`, `/visualizations/quantity`) by `components/layout/ConditionalFooter.tsx`.
- **i18n:** `components/i18n/T.tsx` (translation-string renderer) and `lib/i18n/dictionary.ts` (the EN/ZH string table) are used on nearly every page.
- **Styling:** `app/globals.css` (palette, panel/card system, buttons, search bar, hero banner) `@import`s `app/maps.css` (all Leaflet marker-dot classes).
- **Database:** `lib/supabase.ts` is the Supabase client underlying almost every `lib/queries.ts` function.
