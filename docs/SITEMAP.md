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
| **About** (`/about`) | Project scope, database schema, team, collaborations, a link to the GitHub repo, and (quiet, bottom-of-page) a sign-in link for authorized collaborators. |
| **Sources** (`/sources`) | Every catalogued bibliographic source plus every structured citation (`source_links`) linking a source to a site, context, find, coin item, or mint. Not linked from the main nav — reached directly by URL. |
| **Sign in** (`/login`) | Google OAuth or email/password sign-in for the small set of authorized collaborators who can edit records. Not linked from the main nav; reached via the "Switch to edit mode" link at the bottom of About. |

Signed-in collaborators (and anyone running the app locally in dev, where editing is always on — see `docs/ARCHITECTURE.md` §3) get inline **Edit**/**Delete**/**+ Add** affordances on top of the read-only views above: the site record and its contexts/finds, mint records (plus "+ Add mint" on `/mints`), a coin type's description and its coin-issue rows, and sources/citations on `/sources`, `/sites/[site_code]`, and `/mints/[mint_code]`. Everyone else — including anonymous visitors — sees the plain read-only page; nothing above changes shape for them.

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
- **What it does:** Static content page (project scope, schema, team, collaborations, GitHub link) built from `DataCard` panels; no database access, except for the sign-in status strip at the bottom.
- **Components:** `components/ui/DataCard.tsx`, `components/ui/ImagePlaceholder.tsx`, `components/auth/AuthStatus.tsx` (client component — fetches `/api/auth/me`, renders "Switch to edit mode" or a Sign out button), `components/i18n/T.tsx`
- **Libs/data:** `lib/i18n/dictionary.ts` (all copy is translation keys)

### `/login` — Sign in

- **File:** `app/login/page.tsx` → `components/auth/LoginForm.tsx`
- **What it does:** Client component. "Sign in with Google" (a form posting straight to the `signInWithGoogle` Server Action) plus an email/password form (`signInWithPassword`, via `useActionState`). Not linked from the header/footer nav — only reachable from About's "Switch to edit mode" link or a direct URL.
- **Components:** none besides the form itself
- **Libs/data:** `lib/auth/actions.ts` (`signInWithGoogle`, `signInWithPassword`, `signOut` — all Server Actions), `lib/supabase/server.ts`

### `/auth/callback` — OAuth callback

- **File:** `app/auth/callback/route.ts`
- **What it does:** Route Handler. Exchanges the Google OAuth `code` query param for a session via `supabase.auth.exchangeCodeForSession`, then redirects to `?next=` (default `/`); redirects to `/login?error=...` on failure.
- **Libs/data:** `lib/supabase/server.ts`

### `/api/auth/me` — Session check

- **File:** `app/api/auth/me/route.ts`
- **What it does:** Route Handler, fetched client-side by `AuthStatus` on `/about`. Returns `{ email }` — the signed-in collaborator's email in production, `{ email: null }` unconditionally in dev (there's no login to check in dev; editing is just always on there).
- **Libs/data:** `lib/auth/session.ts` (`getCurrentUserEmail`)

### `/sources` — Sources

- **File:** `app/sources/page.tsx`
- **What it does:** Server component. Loads every `sources` row and every `source_links` row, resolves each link's target (site/context/find/coin item/mint) to a display label and href, and checks `isAuthorized()`. Renders a searchable list of source cards, each showing its structured citations; authorized collaborators get inline edit/delete on both sources and citations plus a "+ Add source" affordance. Not linked from the main nav.
- **Components:** `components/sources/SourcesListClient.tsx` → `components/sources/SourceCard.tsx`, `components/sources/AddSourceLinkForm.tsx` (target-type picker + `TargetSearchCombobox`), `components/edit/EditableSection.tsx`, `components/edit/ConfirmDeleteButton.tsx`
- **Libs/data:** `lib/queries.ts` (`getAllSources`, `getAllSourceLinks`), `lib/admin/resolve-source-link-target.ts` (`resolveSourceLinkTargets`), `lib/admin/guard.ts` (`isAuthorized`), `lib/admin/sources-actions.ts` / `source-links-actions.ts` (Server Actions), `lib/admin/target-search-action.ts` (dev-gated search-as-you-type for the target picker)

### `/search` — Search

- **File:** `app/search/page.tsx`
- **What it does:** Server component. Parses filters from the query string, runs a full-text or filtered site query, computes facet counts, sorts/paginates results, and renders a results map + list with a collapsible filter sidebar.
- **Components:** `components/search/SearchFilters.tsx`, `components/search/SearchFiltersToggle.tsx`, `components/search/SearchResultCard.tsx`, `components/search/SearchableCheckboxList.tsx`, `components/search/SortSelect.tsx`, `components/map/CoinMapSection.tsx` → `components/map/CoinMap.tsx`, `components/site/CoinTypePieChart.tsx`, `components/ui/Pagination.tsx`, `components/i18n/T.tsx` / `TranslatedInput.tsx`
- **Libs/data:** `lib/queries.ts` (`searchSites`, `getAllSites`, `getCoinIssues`, `getFindsForHeatmap`), `lib/search-filters.ts` (facet building, sorting), `lib/city-boundaries.ts` (precision filter), `lib/format.ts`, `lib/name-translation.ts`

### `/sites/[site_code]` — Site record

- **File:** `app/sites/[site_code]/page.tsx`
- **What it does:** Server component. Loads one site plus its contexts, finds (each joined to its `coin_issues` row), and sources; 404s via `notFound()` if the code doesn't exist. Groups finds by issuing mint to build a "Coin Mint Origins" map (findspot ↔ mint towns, dashed connector lines), and renders location/info/classification cards plus a tabbed breakdown of contexts/finds/references. Also checks `isAuthorized()` and, if true, renders a raw-row `SiteRecordSection` edit panel and passes `isDevMode` down so contexts/finds/citations get inline Edit/Delete/+Add.
- **Components:** `components/map/CoinMapSection.tsx`, `components/map/HoardMintOriginsMap.tsx` (pure map), `components/site/SiteDetailTabs.tsx` (uses `components/site/CoinTypePieChart.tsx`, `components/site/ContextCard.tsx`, `components/site/FindRow.tsx`, `components/sources/CitationsSection.tsx`), `components/site/SiteRecordSection.tsx` (dev-only supplementary edit panel), `components/ui/DataCard.tsx`, `components/ui/CopyButton.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getSite`, `getSiteMapSummary`, `getSiteContexts`, `getSiteFinds`, `getSources`, `getAllSourceLinks`), `lib/mint-towns.ts` (`getMintByNameZh`), `lib/format.ts`, `lib/admin/guard.ts` (`isAuthorized`), `lib/admin/sites-actions.ts` (`updateSite`, `createContext`/`updateContext`/`deleteContext`, `createFind`/`updateFind`/`deleteFind` — Server Actions)

### `/mints` — Mints overview

- **File:** `app/mints/page.tsx`
- **What it does:** Server component, revalidates hourly. Loads mint rows from Supabase and merges each with its static dossier fallback (`lib/mint-directory.ts`), then renders an overview map (the same point list the Mint Town visualization shows unfiltered) plus a searchable/filterable list with per-mint coin/site counts. Also checks `isAuthorized()` and passes it to `AddMintSection` for a "+ Add mint" affordance above the list.
- **Components:** `components/mints/MintListClient.tsx`, `components/mints/AddMintSection.tsx` (dev-only), `components/map/MapVisCanvas.tsx` (`kind="mints"`, pure map — shared with the Mint Town visualization), `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getMints`, `getFindsForHeatmap`, `getCoinIssues`), `lib/mint-directory.ts` (`buildMintDirectory` — merges the live `mints` table with `lib/mint-towns.ts`'s static dossier), `lib/pointed-spade-data.ts` (`computeMintStatsFromFinds`, `toMintPoints`), `lib/admin/guard.ts` (`isAuthorized`), `lib/admin/mints-actions.ts` (`createMint`)

### `/mints/[mint_code]` — Mint record

- **File:** `app/mints/[mint_code]/page.tsx`
- **What it does:** Server component. Resolves the mint from the Supabase-backed directory (404s if unrecognized), loads its issued-coin findspot data, and renders location/information cards, a description (DB text, falling back to the local dossier), an issued-coin distribution map with a coin-type filter, an image gallery, a placeholder checklist for incomplete records, and references. Also checks `isAuthorized()`: if true, adds a "Database Record (dev only)" panel (`MintRecordSection`, the raw `mints` row) and gives citations inline Edit/Delete/+Add.
- **Components:** `components/mints/MintIssueDistribution.tsx` (owns the coin-type filter state; renders `components/map/MintIssueDistributionMapCanvas.tsx`, a pure map), `components/mints/MintImageGallery.tsx`, `components/mints/MintPlaceholder.tsx`, `components/mints/MintRecordSection.tsx`, `components/sources/CitationsSection.tsx`, `components/map/SinglePointMap.tsx` (pure map, the mint's own location), `components/ui/DetailRow.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getMints`, `getMintFindspotsData`, `getAllSourceLinks`), `lib/mint-directory.ts` (`buildMintDirectory`, `getMintDirectoryEntryBySlug`), `lib/mint-dossiers.ts` (`getMintDossierByCode` — supplementary-only fields: images, extra references, location notes, source-document coin types), `lib/admin/guard.ts` (`isAuthorized`), `lib/admin/mints-actions.ts` (`updateMint`)

### `/coin-types` — Coin Types overview

- **File:** `app/coin-types/page.tsx`
- **What it does:** Server component. Builds the full typology node list from `coin_type_hierarchy` + `coin_issues`, computes per-node find/site counts, and renders an overview map linking into Find Site's "by type" mode, the full expandable hierarchy tree, and a searchable card grid (level1 excluded — it's a matching/grouping concept, not a browsable card).
- **Components:** `components/coin-types/CoinTypeListClient.tsx` → `components/coin-types/CoinTypeCard.tsx`, `components/coin-types/TypologyTree.tsx` (`FullTypologyTree`), `components/map/MapVisCanvas.tsx` (`kind="sites"`, pure map), `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getFindSpotsMapSites`, `getCoinIssues`, `getCoinTypeHierarchy`, `getFindsForHeatmap`), `lib/coin-type-catalog.ts` (`buildCoinTypeNodes`, `computeAllCoinTypeCounts`), `lib/coin-images.ts` (`getCoinTypeImagePaths` — matches `public/images/type_imgs/` by accession-number prefix)

### `/coin-types/[slug]` — Coin Type record

- **File:** `app/coin-types/[slug]/page.tsx`
- **What it does:** Server component, rendered per-request (no `generateStaticParams` — reading `isAuthorized()` for the edit UI is a dynamic API, so this page can no longer be statically generated at build time; see the file's own comment on the tradeoff). 404s via `notFound()` if the slug doesn't resolve. Renders obverse/reverse images (or a placeholder), an information card (level, parent types, states, mints, inscriptions, coin/site counts), this node's own `description_zh`/`description_en` (editable inline for authorized collaborators), a collapsible coin-issues table (each row editable, with "+ Add" quick-create popups for mint/state/inscription/hierarchy), a collapsible related-find-sites table, and the hierarchy tree scrolled/expanded to this node.
- **Components:** `components/coin-types/CoinTypeImages.tsx`, `components/coin-types/MouldTag.tsx`, `components/coin-types/TypologyTree.tsx`, `components/coin-types/CoinTypeDescriptionSection.tsx`, `components/coin-types/CoinIssuesTable.tsx` → `components/coin-types/CoinIssueRow.tsx` (+ its `*QuickCreateForm` siblings), `components/ui/DetailRow.tsx`, `components/ui/ImagePlaceholder.tsx`, `components/i18n/T.tsx`
- **Libs/data:** `lib/queries.ts` (`getCoinIssues`, `getCoinTypeHierarchy`, `getFindsForHeatmap`, `getFindSpotsMapSites`), `lib/coin-type-catalog.ts` (`buildCoinTypeNodes`, `computeCoinTypeCounts`, `getCoinTypeNodeBySlug`, `isMouldNode`), `lib/coin-images.ts`, `lib/admin/guard.ts` (`isAuthorized`), `lib/admin/taxonomy-actions.ts` (`updateCoinTypeHierarchyDescription`, `createState`, `createInscription`, `createCoinTypeHierarchy`), `lib/admin/coin-issues-actions.ts` (`updateCoinIssue`), `lib/admin/mints-actions.ts` (`createMint`, for the mint quick-create popup)

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
- **Header/nav:** `components/layout/SiteHeader.tsx` (desktop nav, `lg:` and up — Mints, Coin Types, Map Visualizations, Museum Collections, Search, About) + `components/layout/MobileNav.tsx` (hamburger dropdown, below `lg:`) + `components/i18n/LanguageToggle.tsx`. Neither nav includes `/sources` or `/login` — both are reachable only by direct URL or (for `/login`) the link at the bottom of About.
- **Footer:** `components/layout/SiteFooter.tsx`, hidden on the full-viewport map pages (`/visualizations/find-site`, `/visualizations/mint-town`, `/museum-collections`) by `components/layout/ConditionalFooter.tsx`.
- **i18n:** `components/i18n/T.tsx` (translation-string renderer) and `lib/i18n/dictionary.ts` (the EN/ZH string table) are used on nearly every page.
- **Styling:** `app/globals.css` (palette, panel/card system, buttons, search bar, hero banner) `@import`s `app/maps.css` (all Leaflet marker-dot classes, quantity-size and heatmap-opacity CSS variables — see `docs/DATA_VISUALIZATION_CALCULATIONS.md` for the exact size/color math those variables drive).
- **Database:** `lib/supabase.ts` is the read-only anon client underlying almost every `lib/queries.ts` function. Matching against `finds` always keys off `finds.coin_issues_id → coin_issues.id`, never the display-only `coin_issues.coin_type_code`. Writes go through a separate path — `lib/admin/guard.ts`'s `getWriteClient()` — never through `lib/supabase.ts`; see `docs/ARCHITECTURE.md` §3.
- **Session refresh:** `proxy.ts` (repo root) runs on every request matching its `config.matcher` and refreshes the Supabase auth cookie via `lib/supabase/proxy.ts`'s `updateSession` — it never redirects; every page stays publicly readable regardless of sign-in state.
