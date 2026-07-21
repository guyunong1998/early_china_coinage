# Site Map

Early Chinese Coin Finds Database — pre-Qin to early Han coin discoveries: sites, contexts, typology, and geographic distribution.

---

## For Visitors

| Page | What you'll find there |
|---|---|
| **Home** (`/`) | Hero banner with sitewide stats and a search box, three nav cards (Explore, Museum Collections, About), and an interactive map of every find site. |
| **Search** (`/search`) | Full-text search over sites, with filters (region, period, site type, coin type, state, mint, quantity) and a results map. |
| **Site record** (`/sites/[site_code]`) | One archaeological site's full record: location, coin types found, excavation contexts, individual finds, a mint-origins map, and bibliographic sources. |
| **Mints** (`/mints`) | Every documented mint town, with an overview map and a searchable list. |
| **Mint record** (`/mints/[mint_code]`) | One mint town's profile: location, description, issued-coin distribution map, image gallery, and references. |
| **Coin Types** (`/coin-types`) | Every documented coin type, browsable as a full typology tree (钱币/Coin and 钱范/Mould branches) and as a searchable card grid, with an overview map. |
| **Coin Type record** (`/coin-types/[slug]`) | One typology node's detail page: obverse/reverse images, parent types, states, mints, inscriptions, its coin-issue catalogue, related find sites, and its place in the hierarchy tree. |
| **Map Visualizations** (`/visualizations`) | Two map tabs sharing one filter/display system — **Find Site** (every findspot, filterable by coin type or by mint) and **Mint Town** (every mint, filterable by coin type). Landing on `/visualizations` itself drops you into a random one of the two. Both offer three display modes: **Points** (color = match ratio), **Density mass** (blended heatmap), and **Compare** (one distinctly-colored point per selected type/mint, for side-by-side comparison — multiselect in both filter axes). |
| **Museum Collections** (`/museum-collections`) | ANS museum specimens (`ans_data`) shown the same way as the database Mint Town tab, plus a **Search** tab to look up specimens by accession number and drop pins for the ones you pick. |
| **About** (`/about`) | Project scope, database schema, team, collaborations, and a link to the GitHub repo. |

Retired routes: `/map`, `/heatmap`, `/old-ans-spades`, and the old `/visualizations/quantity`, `/visualizations/coin-type`, `/visualizations/mint` tabs no longer exist. The Quantity/Coin Type/Mint three-tab layout was replaced by the current two-tab Find Site / Mint Town design; the pre-`ans_data` spade catalogue heatmap (`/old-ans-spades`, which matched specimens to mints by inscription text rather than per-specimen reconciliation) was removed outright once Museum Collections' per-specimen `ans_data` reconciliation made it redundant — its page, components (`HeatmapPanel`, `PointedSpadeHeatmap`), data files, and generator scripts are gone, not just unlinked.

---

## For Development

Conventions below: **Route** is the URL, **File** is the page component, **Components** are the non-shared pieces it renders (shared layout is listed once at the bottom), **Libs/data** are the non-React modules and data sources it reads from, and **What it does** is a short description of the page's behavior.

### `/` — Home

- **File:** `app/page.tsx`
- **What it does:** Server component. Fetches all mapped sites and renders the hero banner, nav cards, and the homepage map widget under a "View More Map Visualizations" link into `/visualizations`.
- **Components:** `components/home/HeroBanner.tsx` (own async server component — fetches its own stats via `getDatabaseStats` and renders the search box), `components/home/NavCards.tsx`, `components/map/CoinFilterMap.tsx` (pure map — clickable site markers + default density heat layer), `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getMapSites`, plus `getDatabaseStats` via `HeroBanner`), `app/maps.css` (marker dot classes), `app/globals.css` (`--hero-gradient-*`, `.panel-header`/`.panel-body`/`.panel-nav-card`)

### `/about` — About

- **File:** `app/about/page.tsx`
- **What it does:** Static content page (project scope, schema, team, collaborations, GitHub link) built from `DataCard` panels; no database access.
- **Components:** `components/ui/DataCard.tsx`, `components/ui/ImagePlaceholder.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/i18n/dictionary.ts` (all copy is translation keys)

### `/search` — Search

- **File:** `app/search/page.tsx`
- **What it does:** Server component. Parses filters from the query string, runs a full-text or filtered site query, computes facet counts, sorts/paginates results, and renders a results map + list with a collapsible filter sidebar.
- **Components:** `components/search/SearchFilters.tsx`, `components/search/SearchFiltersToggle.tsx`, `components/search/SearchResultCard.tsx`, `components/search/SearchableCheckboxList.tsx`, `components/search/SortSelect.tsx`, `components/map/CoinMapSection.tsx` → `components/map/CoinMap.tsx`, `components/site/CoinTypePieChart.tsx`, `components/ui/Pagination.tsx`, `components/i18n/T.tsx` / `TranslatedInput.tsx`
- **Libs/data:** `lib/queries.ts` (`searchSites`, `getAllSites`, `getCoinIssues`, `getFindsForHeatmap`), `lib/search-filters.ts` (facet building, sorting), `lib/city-boundaries.ts` (precision filter), `lib/format.ts`, `lib/name-translation.ts`

### `/sites/[site_code]` — Site record

- **File:** `app/sites/[site_code]/page.tsx`
- **What it does:** Server component. Loads one site plus its contexts, finds (each joined to its `coin_issues` row), and sources; 404s via `notFound()` if the code doesn't exist. Groups finds by issuing mint to build a "Coin Mint Origins" map (findspot ↔ mint towns, dashed connector lines), and renders location/info/classification cards plus a tabbed breakdown of contexts/finds/references.
- **Components:** `components/map/CoinMapSection.tsx`, `components/map/HoardMintOriginsMap.tsx` (pure map), `components/site/SiteDetailTabs.tsx` (uses `components/site/CoinTypePieChart.tsx`), `components/ui/DataCard.tsx`, `components/ui/CopyButton.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getSite`, `getSiteMapSummary`, `getSiteContexts`, `getSiteFinds`, `getSources`), `lib/mint-towns.ts` (`getMintByNameZh`), `lib/format.ts`

### `/mints` — Mints overview

- **File:** `app/mints/page.tsx`
- **What it does:** Server component, revalidates hourly. Loads mint rows from Supabase and merges each with its static dossier fallback (`lib/mint-directory.ts`), then renders an overview map (the same point list the Mint Town visualization shows unfiltered) plus a searchable/filterable list with per-mint coin/site counts.
- **Components:** `components/mints/MintListClient.tsx`, `components/map/MapVisCanvas.tsx` (`kind="mints"`, pure map — shared with the Mint Town visualization), `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getMints`, `getFindsForHeatmap`, `getCoinIssues`), `lib/mint-directory.ts` (`buildMintDirectory` — merges the live `mints` table with `lib/mint-towns.ts`'s static dossier), `lib/pointed-spade-data.ts` (`computeMintStatsFromFinds`, `toMintPoints`)

### `/mints/[mint_code]` — Mint record

- **File:** `app/mints/[mint_code]/page.tsx`
- **What it does:** Server component. Resolves the mint from the Supabase-backed directory (404s if unrecognized), loads its issued-coin findspot data, and renders location/information cards, a description (DB text, falling back to the local dossier), an issued-coin distribution map with a coin-type filter, an image gallery, a placeholder checklist for incomplete records, and references.
- **Components:** `components/mints/MintIssueDistribution.tsx` (owns the coin-type filter state; renders `components/map/MintIssueDistributionMapCanvas.tsx`, a pure map), `components/mints/MintImageGallery.tsx`, `components/mints/MintPlaceholder.tsx`, `components/map/SinglePointMap.tsx` (pure map, the mint's own location), `components/ui/DetailRow.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getMints`, `getMintFindspotsData`), `lib/mint-directory.ts` (`buildMintDirectory`, `getMintDirectoryEntryBySlug`), `lib/mint-dossiers.ts` (`getMintDossierByCode` — supplementary-only fields: images, extra references, location notes, source-document coin types)

### `/coin-types` — Coin Types overview

- **File:** `app/coin-types/page.tsx`
- **What it does:** Server component. Builds the full typology node list from `coin_type_hierarchy` + `coin_issues`, computes per-node find/site counts, and renders an overview map linking into Find Site's "by type" mode, the full expandable hierarchy tree, and a searchable card grid (level1 excluded — it's a matching/grouping concept, not a browsable card).
- **Components:** `components/coin-types/CoinTypeListClient.tsx` → `components/coin-types/CoinTypeCard.tsx`, `components/coin-types/TypologyTree.tsx` (`FullTypologyTree`), `components/map/MapVisCanvas.tsx` (`kind="sites"`, pure map), `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getFindSpotsMapSites`, `getCoinIssues`, `getCoinTypeHierarchy`, `getFindsForHeatmap`), `lib/coin-type-catalog.ts` (`buildCoinTypeNodes`, `computeAllCoinTypeCounts`), `lib/coin-images.ts` (`getCoinTypeImagePaths` — matches `public/images/type_imgs/` by accession-number prefix)

### `/coin-types/[slug]` — Coin Type record

- **File:** `app/coin-types/[slug]/page.tsx`
- **What it does:** Server component, statically generated (`generateStaticParams`) for every typology node's slug. 404s if the slug doesn't resolve. Renders obverse/reverse images (or a placeholder), an information card (level, parent types, states, mints, inscriptions, coin/site counts), a description placeholder, a collapsible coin-issues table, a collapsible related-find-sites table, and the hierarchy tree scrolled/expanded to this node.
- **Components:** `components/coin-types/CoinTypeImages.tsx`, `components/coin-types/MouldTag.tsx`, `components/coin-types/TypologyTree.tsx`, `components/ui/DetailRow.tsx`, `components/ui/ImagePlaceholder.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getCoinIssues`, `getCoinTypeHierarchy`, `getFindsForHeatmap`, `getFindSpotsMapSites`), `lib/coin-type-catalog.ts` (`buildCoinTypeNodes`, `computeCoinTypeCounts`, `getCoinTypeNodeBySlug`, `isMouldNode`), `lib/coin-images.ts`

### `/visualizations` — Random tab redirect

- **File:** `app/visualizations/page.tsx`
- **What it does:** No UI — `export const dynamic = 'force-dynamic'`, then `redirect()`s to a randomly-chosen one of `/visualizations/{mint-town,find-site}` on every request.
- **Components:** none
- **Libs/data:** none (just `next/navigation`)

### `/visualizations/find-site` — Find Site tab

- **File:** `app/visualizations/find-site/page.tsx`
- **What it does:** Server component. Fetches every findspot, coin issues, the typology hierarchy, and finds; filters the site list by the `?precision=` query param. Renders the full-bleed map with a floating filter panel: **Filter by** Coin Type (multiselect, "add another" picker built on `TypologyFilterBar`) or Mint (multiselect, searchable checkbox list), and **Display** Points / Density mass / Compare for either axis.
- **Components:** `components/visualizations/MapVisualization.tsx` (`FindSpotsVisualization` — owns all filter/view-mode state, plus the shared `ToggleButtons`/`ViewModeRow`/`MapExplanation`/`CompareLegend`/`TypologyMultiSelect` pieces used by all three visualization components) → `components/map/MapVisCanvas.tsx` (`kind="sites"`, pure map — heat-ratio dots, dropped pins, Compare dots), `components/visualizations/TypologyFilterBar.tsx`, `components/ui/MultiSelectSearch.tsx`, `components/visualizations/MapVisualizationOverlay.tsx` (floating collapsible panel shell), `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getFindSpotsMapSites`, `getCoinIssues`, `getCoinTypeHierarchy`, `getFindsForHeatmap`), `lib/city-boundaries.ts` (precision filter/counts), `lib/context-heatmap.ts` (`computeSiteHeatStates`, `FilterMode`/`ViewMode`/`SiteHeatState` types), `lib/mint-filter.ts` (mint multiselect matching + Compare quantities), `lib/typology-filter.ts` (coin-type multiselect matching + Compare quantities), `lib/color-scale.ts` (ratio gradient, density gradient, stable-slot identity colors)

### `/visualizations/mint-town` — Mint Town tab

- **File:** `app/visualizations/mint-town/page.tsx`
- **What it does:** Server component. Fetches coin issues, the typology hierarchy, and finds; aggregates every documented mint town's totals. Renders the full-bleed map with the same coin-type multiselect + Points/Density/Compare display panel as Find Site, scaled to mint towns instead of find sites.
- **Components:** `components/visualizations/MapVisualization.tsx` (`MintTownVisualization`) → `components/map/MapVisCanvas.tsx` (`kind="mints"`), same shared filter-panel pieces as Find Site
- **Libs/data:** `lib/queries.ts` (`getCoinIssues`, `getCoinTypeHierarchy`, `getFindsForHeatmap`), `lib/pointed-spade-data.ts` (`computeMintStatsFromFinds`, `toMintPoints`, `computeMintTypeQuantities`), `lib/typology-filter.ts`

### `/museum-collections` — Museum Collections (ANS specimens)

- **File:** `app/museum-collections/page.tsx`
- **What it does:** Server component. Fetches every reconciled `ans_data` specimen (mint/state/hierarchy/inscription already resolved per-row) plus coin issues and the typology hierarchy. Renders the same Mint Town-shaped map/filter panel as `/visualizations/mint-town`, plus its own **Search** tab (top-level tab row inside the panel) for looking up specimens by accession number.
- **Components:** `components/visualizations/MapVisualization.tsx` (`AnsMintTownVisualization`, its own `MuseumMapOverlay`) → `components/map/MapVisCanvas.tsx` (`kind="mints"`), `components/museum/AccessionNumberSearch.tsx` (multiselect specimen lookup → dropped pins, colored per selection), same coin-type multiselect pieces as the other two visualizations
- **Libs/data:** `lib/ans-museum-data.ts` (`getAnsSpecimens`), `lib/queries.ts` (`getCoinIssues`, `getCoinTypeHierarchy`), `lib/pointed-spade-data.ts` (`AnsSpecimen` type, `computeAnsMintStats`, `computeAnsMintTypeQuantities`, `getMatchingAnsSpecimensMulti`, `ansCollectionUrl`)

---

### Shared across every page (not repeated above)

- **Root layout:** `app/layout.tsx` — loads fonts (Geist, Playfair Display, Spectral via `next/font/google`), wraps everything in `lib/i18n/LanguageContext.tsx` (`LanguageProvider`), renders `components/layout/SiteHeader.tsx` and `components/layout/ConditionalFooter.tsx`, sets the `/coin.svg` favicon.
- **Header/nav:** `components/layout/SiteHeader.tsx` (desktop nav, `lg:` and up — Mints, Coin Types, Map Visualizations, Museum Collections, Search, About) + `components/layout/MobileNav.tsx` (hamburger dropdown, below `lg:`) + `components/i18n/LanguageToggle.tsx`.
- **Footer:** `components/layout/SiteFooter.tsx`, hidden on the full-viewport map pages (`/visualizations/find-site`, `/visualizations/mint-town`, `/museum-collections`) by `components/layout/ConditionalFooter.tsx`.
- **i18n:** `components/i18n/T.tsx` (translation-string renderer) and `lib/i18n/dictionary.ts` (the EN/ZH string table) are used on nearly every page.
- **Styling:** `app/globals.css` (palette, panel/card system, buttons, search bar, hero banner) `@import`s `app/maps.css` (all Leaflet marker-dot classes, quantity-size and heatmap-opacity CSS variables — see `docs/DATA_VISUALIZATION_CALCULATIONS.md` for the exact size/color math those variables drive).
- **Database:** `lib/supabase.ts` is the Supabase client underlying almost every `lib/queries.ts` function. Matching against `finds` always keys off `finds.coin_issues_id → coin_issues.id`, never the display-only `coin_issues.coin_type_code`.
