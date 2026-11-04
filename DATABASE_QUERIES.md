# Database Queries by Page

What each route in `app/` reads from Supabase (Postgres via PostgREST), how much data that pulls, how it's filtered, and how caching/auth affect it.

**Client used for all reads below:** `lib/supabase.ts` — a plain `supabase-js` client with the public **anon key**. Row Level Security grants `SELECT` to `public` on every content table (confirmed via `pg_policies`), so an anonymous visitor and a signed-in admin read exactly the same rows; only `INSERT`/`UPDATE`/`DELETE` are restricted to `authenticated` + `is_admin()`. Auth therefore never filters what a page's *reads* return — it only gates (a) a couple of admin-only lookups noted per page below, and (b) whether edit UI renders.

**Row counts** (live, re-checked 2026-09-30): `sites` 1,830 (`v_coin_map_sites` 1,797 have coordinates) · `contexts` 2,181 · `finds` 6,975 · `coin_issues` / `v_coin_issues_flat` 2,279 · `coin_type_hierarchy` 72 · `sources` 957 · `source_links` 2,336 · `states` 14 · `inscriptions` 343 · `images` 28 · `mints` 126 · `ans_data` / `v_ans_flat` 2,947. Unchanged from the last audit — everything that's moved since is on the code side, not the data side.

**Rendering key:**
- **Static/ISR** — no `cookies()`/`searchParams` read, so Next can pre-render the page and serve it from the Full Route Cache; `revalidate = 86400` (24h) then triggers a background rebuild on next request after expiry.
- **Dynamic (per-request)** — the page calls `isAuthorized()` (→ `createServerSupabaseClient()` → `cookies()`) and/or reads `searchParams`, both of which are "dynamic APIs" that force Next to render on every request. `revalidate = 86400` is still declared on most of these, which sets the default lifetime for the underlying `fetch` calls in Next's **Data Cache** — so the Supabase round-trips themselves can still be cache-hits for up to 24h even though the page shell re-renders each time. It does not mean the page is statically served.

Every list-fetching helper in `lib/queries.ts` pages through PostgREST with `fetchAllPages()` (1,000-row cap per request) rather than truncating, so counts below are full-table unless a query has an explicit filter.

**⚠️ markers below** point to `todo.md` — the running egress-audit Q&A log with the full reasoning, draft SQL, and decisions for each flagged read. This file just says *what's heavy here*; `todo.md` says *why, and what to do about it*.

**The `isAuthorized()`-forces-dynamic-render bug is fixed** (see `todo.md`'s status update for how): `/coin-types/[type_code]`, `/mints`, `/mints/[mint_code]`, `/sites/[site_code]`, and `/sources` each split into a public page (never calls `cookies()`, ISR-eligible) and a sibling `/edit` route that does the auth check and renders the same shared content component with `authorized` flipped on. The public pages are the ones documented below; the `/edit` siblings aren't listed separately since they run identical queries, just gated behind a redirect-if-unauthorized.

**The `searchParams`-breaks-caching bug is fixed** on `/visualizations/find-site`, `/visualizations/mint-town`, `/museum-collections` (todo.md Q5a/Q5b): the pages no longer read `searchParams`. The visualization components decode their deep-link params client-side with `useSearchParams()`, and each page wraps them in `<Suspense>` (required for `useSearchParams` on a static route). `next build` now reports all three as `○ (Static)`, 1d revalidate. `/search` is the one page that's supposed to stay dynamic (it does real server-side filtering).

---

## `/` (Home) — `app/page.tsx`
- **Queries:** None directly. The seven coin-type showcase photos are now hardcoded (`showcaseItems` array in the page file itself, with a comment on how to regenerate the list if `img_acc_num` values change) instead of fetching `getCoinIssues()` to pick them at render time — todo.md's Q5-response "hardcode the 7 coin types" fix has been **applied**. The only query on this route is inside `<HeroBanner>` (`components/home/HeroBanner.tsx`), unchanged: `getDatabaseStats()` → two `head: true` count-only queries (`v_coin_map_sites`, 1,797 / `finds`, 6,975 — neither returns row bodies) plus one RPC call, `sum_total_quantity_for_map()`, which sums `total_quantity_for_map` in Postgres and returns a single number.
- **Used for:** the hero banner's live database-size stats; the coin-types teaser section's photos.
- **Rendering:** Static/ISR, `revalidate = 86400`. No auth check, no searchParams — genuinely pre-rendered and CDN-cacheable.
- **Auth impact:** None.
- **Note:** hardcoding the showcase photos means this page no longer carries a live DB dependency for that section at all (it was already cheap before, since `/` was fully cached — this is a resilience/simplicity win, not an egress one, same trade-off todo.md flagged when proposing it). The trade-off todo.md named (losing the per-render random photo pick) was accepted.

## `/about` — `app/about/page.tsx`

- **Queries:** None. Fully static content.
- **Auth impact:** Renders `<AuthStatus>`, a client component that calls `/api/auth/me` — not a page-level DB call.

## `/search` — `app/search/page.tsx`

- **Queries:** Unchanged from the last audit.
  - `getAllSites()` → `v_coin_map_sites` (all 1,797 geocoded rows, now including `description_zh/en` + `period_zh/en`) **+** `getPrecisionSupplementSites()` (~39 county-level rows, which also carry description/period). One full scan; `attachSiteDetails()`'s second full `sites` pass is gone.
  - `getCoinIssues()` → `v_coin_issues_flat`, all 2,279 rows.
  - `getFindsForSiteCodes(pageResults)` → scoped to the 20 sites on the current results page.
- **Filtering:** All text search, facet filtering, sorting, and pagination still happen in memory in the page component (`filterSitesByQuery()`, `lib/search-filters.ts`), not in SQL.
- **Rendering:** Declared Static/ISR (`revalidate = 86400`, `maxDuration = 60`), but reads `searchParams` for every filter/sort/page value — still dynamic per unique query string, by design (this is the one page that legitimately needs it).
- **Auth impact:** None on data returned.
- **⚠️ todo.md:** `getAllSites()`'s double `sites` scan is **fixed**: `scripts/add-v-coin-map-sites-details.sql` (applied 2026-10-01) appends `description_zh/en` + `period_zh/en` to `v_coin_map_sites`. It's a `CREATE OR REPLACE` so grants are kept, and it's verified on live data: the original 32 columns are byte-identical (same md5 over all 1,797 rows) and the new columns match `sites`/`periods` on every row. Other view consumers select `MAP_SITE_FIELDS` explicitly, so their payloads are unchanged.

## `/coin-types` — `app/coin-types/page.tsx`

- **Queries:** `getCoinIssues()` (2,279 rows) + `getCoinTypeHierarchy()` (72 rows) + `getFindsForHeatmap()` (all 6,975 `finds` rows, joined to `contexts!inner(site_code)`) — unchanged.
- **Used for:** building the full typology tree and per-type find/site counts shown on each type's card; no per-request filtering (client-side in `CoinTypeListClient`).
- **Rendering:** Static/ISR, `revalidate = 86400`. No auth check or searchParams — pre-rendered.
- **Auth impact:** None.
- **Note:** this remains the one legitimate full-`finds`-scan consumer among the three remaining `getFindsForHeatmap()` call sites — it needs every type's count at once. todo.md never flagged this one as a problem.

## `/coin-types/[type_code]` — `app/coin-types/[type_code]/page.tsx`

Route param renamed from `[slug]` to `[type_code]` since the last audit — `coin_type_hierarchy` now has a real, stored `type_code` column (`scripts/add-coin-type-code.sql`, backfilled from the app's own slug computation so existing URLs kept working), instead of a slug recomputed at request time by rebuilding the whole 72-row tree. This fully resolves what was previously todo.md Q6's discussion of "why `[slug]` and not `[type_code]`" — it's `[type_code]` now, a direct `.eq('type_code', …)` lookup, the same pattern `[site_code]`/`[mint_code]` always used.

- **Queries** (all via the shared `CoinTypeDetailContent` component, used by both this page and `/coin-types/[type_code]/edit`):
  - `generateMetadata`: `getCoinTypeByCode(type_code)` — single-row `.eq(...).maybeSingle()`, not a full hierarchy fetch.
  - `generateStaticParams`: `getCoinTypeHierarchy()` (72 rows) — required for every `type_code` to actually be prerendered into the Full Route Cache rather than rendered dynamically forever (a App Router quirk noted in the page's own comment: omitting `generateStaticParams` on a dynamic segment keeps it fully dynamic even after `isAuthorized()` is removed).
  - Page body: `getCoinTypeHierarchy()` (72, tree structure) + `getCoinIssuesByHierarchyIds(node.matchedHierarchyIds)` + `getCoinFindsByHierarchyIds(node.matchedHierarchyIds)` + `getMints()` (126, full — needed for every visitor's mint-name → `/mints/[code]` links) + `getMapSitesByCodes([...matchedSiteCodes])` (scoped to just this node's related sites).
  - **Admin-only** (only on `/coin-types/[type_code]/edit`): `getStates()` (14) + `getInscriptions()` (343) for the coin-issue-editing comboboxes.
- **Filtering:** Now genuinely server-side and scoped — `getCoinIssuesByHierarchyIds`/`getCoinFindsByHierarchyIds` filter by `.in('coin_type_hierarchy_id', …)` / `.in('coin_type_id', …)` in the query itself, and `getMapSitesByCodes` takes the exact site codes already known from the scoped finds. No more "fetch everything, throw most of it away" client-side filtering.
- **Rendering:** **Static/ISR now** (`revalidate = 86400`, `generateStaticParams` prerenders every `type_code` at build time). The public page never calls `cookies()`/`isAuthorized()` — that moved to `/coin-types/[type_code]/edit`, a separate route.
- **Auth impact:** None on the public route; `/edit` adds `states`/`inscriptions` and gates the edit UI.
- **⚠️ todo.md:** this was flagged as **the worst egress offender site-wide** (full `finds` + full map-sites scanned and discarded on every visit, with no caching at all). Both root causes are now fixed: the scoped-query fix (Q4/Q6's `getFindsByIssueIds` proposal, implemented instead as hierarchy-id-scoped `getCoinFindsByHierarchyIds`/`getCoinIssuesByHierarchyIds`/`getMapSitesByCodes`) and the caching-bug fix (the `/edit`-route split). See todo.md's status update for detail — this item is resolved, not just proposed.

## `/mints` — `app/mints/page.tsx` (content in `components/mints/MintsPageContent.tsx`)

- **Queries:** `getMints()` (126, + joined `states`) + `getMintStats()` (`v_mint_stats`, 126 pre-aggregated rows — one per mint) + `getImages()` (all 28, joined to `sources`). **No longer calls `getFindsForHeatmap()` or `getCoinIssues()`** — the full 6,975-row `finds` and 2,279-row `v_coin_issues_flat` pulls are both gone.
- **Used for:** the mint-town overview map preview and the full searchable mint directory list (stats, coin-type tags, issue counts, completeness score). Per-mint find/coin/site counts, inscriptions, catalogued issue counts, and bilingual coin-type tags all come straight from `v_mint_stats` (stats via `computeMintStatsFromView`); only the completeness score is still computed in memory, from the `mints` rows.
- **Rendering:** **Static/ISR** (`revalidate = 86400`). The public page never calls `isAuthorized()` — that lives in `/mints/edit`, a separate route rendering the same `MintsPageContent` with `authorized` on.
- **Auth impact:** None on the public route; `/mints/edit` only changes whether `<AddMintSection>` renders, no extra queries.
- **⚠️ todo.md Q1/Q2/Q3:** **`v_mint_stats` is applied** (`scripts/add-mint-stats-view.sql`, live as of 2026-10-01) and wired in. The draft had to be corrected before running — it referenced a `coin_issues.inscription` column that no longer exists (now `inscription_id` → `inscriptions`), collected inscriptions from every catalogued issue rather than only issues with finds, and left-joined `contexts` where `getFindsForHeatmap()` inner-joins. The corrected view was checked against the old JS path (`computeMintStatsFromFinds`) on live data: deep-equal output for all 126 mints. `issue_count` and `type_labels` were then folded into the same view (replacing `buildMintTypeLabels`, now removed), again verified deep-equal against the old JS output, so the page no longer needs `getCoinIssues()` at all. Nothing left open on this page.

## `/mints/[mint_code]` — `app/mints/[mint_code]/page.tsx` (content in `components/mints/MintDetailContent.tsx`)

- **Queries:**
  - `resolveMintPage()` (wrapped in React `cache()`, shared by `generateMetadata` and the page body, and reused by `/mints/[mint_code]/edit`): `getMintByCode(mint_code)` — single-row `.eq('mint_code', …).maybeSingle()`, **no longer** a full `getMints()` + `getImages()` scan. `getImagesByIds(dbMint.image_ids)` scopes the images lookup to just this mint's own images, instead of the full `images` table.
  - `getMintFindspotsData(mint.id)` — unchanged, already-correct scoped pattern: `v_coin_issues_flat` `.eq mint_id` → `finds` `.in coin_issues_id` (chunked) → `contexts` → `v_coin_map_sites`. Returns empty early if the mint has no catalogued issues.
  - `getCoinIssues()` (2,279, full) + `getCoinTypeHierarchy()` (72, full) — still unscoped, used only to resolve `distribution.typeLabels` back to catalog slugs. Still low priority per the original audit (small tables).
  - `generateStaticParams`: `getMints()` (126) — prerenders every `mint_code` the same way `/coin-types/[type_code]` now does.
  - `getSourceLinksForMint(mint_code)` → scoped `source_links` query, then `getSources(...)` scoped to just those codes.
- **Rendering:** **Static/ISR now** (`revalidate = 86400`, `generateStaticParams`). Editing moved to `/mints/[mint_code]/edit`, which does the `isAuthorized()` check and gates the dev-only "Database Record" panel.
- **Auth impact:** None on the public route; `/edit` gates only the debug panel and edit affordances, no extra queries.
- **⚠️ todo.md Q6:** the proposed `getMintByCode()` fix (drafted in Q6) is **applied**, along with a matching `getImagesByIds()` scoping that wasn't explicitly drafted but follows the same pattern. This item is resolved.

## `/museum-collections` — `app/museum-collections/page.tsx`

- **Queries:** `getAnsSpecimens()` → now reads `v_ans_flat` (all 2,947 rows) instead of joining `ans_data` to `mints`/`states` client-side — todo.md's Q5-response spec (id, catalogue number, hierarchy levels 1–5 zh/en, inscription zh/en, mint zh/en, state zh/en) is implemented exactly as specced in `scripts/add-ans-flat-view.sql`. Plus `getMintInfos()` (126).
- **Used for:** the ANS mint-town map visualization and its accession-number search, entirely client-rendered from this one payload.
- **Rendering:** Static/ISR, `revalidate = 86400`. `view`/`types` deep-link params are now read client-side (`useSearchParams`), so the page is genuinely static.
- **Auth impact:** None.
- **⚠️ todo.md:** the view removed the client-side join code (and the `getCoinIssues()` fetch this page used to make just for inscription labels) but **does not by itself reduce row count/egress** — full `ans_data`/`v_ans_flat` is still shipped to the client for entirely in-browser aggregation and search. The `searchParams` caching fix is done.

## `/sites/[site_code]` — `app/sites/[site_code]/page.tsx` (content in `components/site/SiteDetailContent.tsx`)

- **Queries (unchanged from the last audit):** `getSite` → `getSiteMapSummary` → `getSiteContexts` → `getSiteFinds(contextCodes)` → `getMintInfos()` (126, full) → **admin-only** `getCoinIssues()` (2,279, full) + unconditional `getCoinTypeHierarchy()` (72) → `getSourceLinksForSite(...)`. Every finds/contexts/sources query here is already properly `.eq`/`.in`-scoped; the one full-table read (`getCoinIssues()`) backs an admin edit dropdown that legitimately needs every option.
- **Rendering:** **Static/ISR (on first visit).** Was dynamic and uncached despite `revalidate = 86400` (verified 2026-10-01 against `next build` + `next start`: `ƒ` in the build output, every request `Cache-Control: private, no-store`, ~1.6s each). In the App Router a dynamic segment with no `generateStaticParams` is treated as dynamic, even with no `cookies()`/`searchParams`. The page comment's worry (~1,830 sites × ~9 queries at build) only applies to prerendering every site. `generateStaticParams() { return [] }` prerenders nothing at build but caches each site on first visit: tested as `●` in the build, first request `MISS` (2.2s), then `HIT` (0.05s), unknown codes still 404. Admin site edits already call `revalidatePath('/sites/[site_code]', 'page')`, so edits still show. **Applied 2026-10-01.** Editing moved to `/sites/[site_code]/edit`.
- **Auth impact:** `/edit` adds the `getCoinIssues()` full-catalog query for the find-editing combobox, and renders the raw "Site Record (dev only)" panel.
- **⚠️ todo.md Q6:** the caching-bug fix (edit-route split) is applied. Row-scoping was already close to ideal here and remains so — no change needed or made.

## `/sources` — `app/sources/page.tsx` (content in `components/sources/SourcesPageContent.tsx`)

- **Queries:** `getAllSources()` (`sources`, all 957 rows) + `getAllSourceLinks()` (`source_links`, all 2,336 rows) + `resolveSourceLinkTargets(links)` — unchanged.
- **Used for:** the full searchable/filterable source bibliography; search and filtering are client-side over this one fetched set.
- **Rendering:** **Static/ISR now** (`revalidate = 86400`). Editing moved to `/sources/edit`, which does the `isAuthorized()` check.
- **Auth impact:** None on the public route; `/edit` only gates whether inline add/edit controls render.
- **Deprioritized, not fixing:** no aggregation/scoping candidate exists for the full `sources`+`source_links` reads, but none is needed. The page is very rarely viewed and rarely edited, and with ISR plus `revalidatePath('/sources')` in the admin actions, the full reads run at most once per day with traffic — ISR only rebuilds on a visit, never on a timer, and an edit's `revalidatePath` also just defers the rebuild to the next visit.

## `/visualizations` — `app/visualizations/page.tsx`

- **Queries:** None. Pure `redirect()` to one of two tabs, chosen randomly server-side.
- **Rendering:** `export const dynamic = 'force-dynamic'` — explicitly opted out of caching so the coin flip re-rolls every request.

## `/visualizations/find-site` — `app/visualizations/find-site/page.tsx`

- **Queries:** `getFindSpotsMapSites()` (`v_coin_map_sites` 1,797 + precision supplements) + `getCoinIssues()` (2,279) + `getCoinTypeHierarchy()` (72) + `getFindsForHeatmap()` (all 6,975) + `getMintInfos()` (126) — unchanged.
- **Filtering:** All client-side. `precision` was the one server-side filter; it's now applied in `FindSpotsVisualization` over the full site list (the default "all" tab already shipped every site, so the payload doesn't grow). `mode`/`mints`/`types`/`view` are decoded client-side too.
- **Rendering:** Static/ISR (`revalidate = 86400`). The page doesn't read `searchParams`.
- **⚠️ todo.md Q5a/Q5b:** the free fix is **applied**.

## `/visualizations/mint-town` — `app/visualizations/mint-town/page.tsx`

- **Queries:** `getCoinIssues()` (2,279) + `getCoinTypeHierarchy()` (72) + `getFindsForHeatmap()` (all 6,975) + `getMintInfos()` (126) — unchanged.
- **Rendering:** Static/ISR (`revalidate = 86400`); `view`/`types` deep-link params are read client-side, same fix as `/visualizations/find-site`.

## `/login` — `app/login/page.tsx`

- **Queries:** None directly. Submitting the form calls the `signInWithPassword` Server Action — not a table read/write.
- **Rendering:** Static shell.

## `/auth/callback` (Route Handler) — `app/auth/callback/route.ts`

- **Queries:** None on app tables — exchanges an OAuth code via Supabase Auth, then redirects.

## `/api/auth/me` (Route Handler) — `app/api/auth/me/route.ts`

- **Queries:** None on app tables — reads the JWT via Supabase Auth `getClaims()`. Fetched client-side so the rest of a page doesn't have to become request-dynamic just to show login state.
- **Rendering:** Always dynamic (per-request auth check by design), isolated to this one small endpoint.

---

## Cross-cutting notes

- **No page issues raw SQL** — every read goes through PostgREST via `supabase-js`.
- **Three Postgres views now do the heavy joining/aggregating that pages would otherwise do client-side:** `v_coin_map_sites` (aggregating — count/sum/string_agg per site, rewritten in `scripts/remake-v-coin-finds.sql` to join straight off `sites`/`contexts`/`finds` rather than the old wide `v_coin_finds`), `v_coin_issues_flat` (flattening — coin_issues pre-joined to mints/states/inscriptions/hierarchy), and `v_coin_finds` (flattening, **rewritten from a wide 8-way-join view that was confirmed unused, into a slim per-find view — `find_code`, codes, and `(id, zh, en)` triples for coin type/inscription/state/mint plus `quantity_for_map` — that's now the backing source for `getCoinFindsByHierarchyIds`,** the scoped-finds query powering `/coin-types/[type_code]`). All three views' `CREATE VIEW` source is checked into `scripts/`, closing the "no source-of-truth in git" gap the last audit flagged for `v_coin_map_sites`/`v_coin_finds`.
- **The `isAuthorized()`-forces-dynamic-render bug is fixed** across all 5 pages it used to hit, via the `/edit`-route split pattern (see each page's section above and todo.md's status update for the mechanics). It no longer multiplies any of this doc's other egress numbers by "once per visit" — those pages are back to "once per 24h" (or once per build, for the three with `generateStaticParams`).
- **The "legacy hierarchy" fallback** (`applyLegacyHierarchy` in `lib/queries.ts`) still adds a conditional extra query wherever a row's `coin_type_hierarchy_id` is null. Migration-transition path, not steady-state cost.
- **One resilience fallback still degrades rather than fails:** `getFindsForSiteCodes()`, unchanged. (`attachSiteDetails()` and its fallback were removed along with the second `sites` scan.)
- **Auth's effect on data remains narrow:** it only ever adds `getStates()`/`getInscriptions()` (on `/coin-types/[type_code]/edit`) or `getCoinIssues()` (on `/sites/[site_code]/edit`) for admin edit UI, plus a couple of dev-only debug panels. It no longer has any *indirect* caching effect, since it's confined to the `/edit` routes that were never meant to be cached in the first place.

---

## Egress backlog (see `todo.md`'s status update for full detail)

Resolved since the last pass:
1. ✅ `isAuthorized()`-forces-dynamic bug, all 5 affected pages — fixed via the `/edit`-route split.
2. ✅ `getFindsByIssueIds`-equivalent + `getMapSitesByCodes` for `/coin-types/[type_code]` — fixed (implemented as hierarchy-id-scoped queries, a cleaner variant of what was drafted).
3. ✅ `getMintByCode()` for `/mints/[mint_code]` — fixed, plus a matching `getImagesByIds()`.
4. ✅ `v_ans_flat` applied and wired into `getAnsSpecimens()`.
5. ✅ `CREATE VIEW` source committed for `v_coin_map_sites`/`v_coin_finds`, and `v_coin_finds` rewritten from unused/wide into actively-used/slim.
6. ✅ Home page (`/`) no longer queries `getCoinIssues()` for its showcase photos — hardcoded instead.
7. ✅ `v_mint_stats` applied and wired into `/mints` — the page no longer pulls the full `finds` table or `coin_issues` catalogue.

8. ✅ Caching un-broken on `/visualizations/mint-town`, `/visualizations/find-site`, `/museum-collections` — deep-link params decoded client-side.
9. ✅ `getAllSites()`'s second full `sites` scan removed — description/period now come from `v_coin_map_sites`.

10. ✅ `/sites/[site_code]` now actually cached — `generateStaticParams() { return [] }` (see that page's entry).

Still open: nothing.

Deprioritized:
- **`/sources`** full `sources`+`source_links` reads — rarely viewed, rarely edited, and ISR-cached, so the reads are rare; not worth a scoping pass.
