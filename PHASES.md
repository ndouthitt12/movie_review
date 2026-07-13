# Build Phases — Detailed Breakdown

Companion to [PLAN.md](PLAN.md). Five phases, each split into subphases with concrete deliverables and exit criteria. Read the parallelization rules first — they define which subphases can be worked simultaneously (by multiple agents/sessions or interleaved work) and which are strictly sequential.

---

## Parallelization rules

### Hard sequencing (must NOT be parallelized)

1. **Schema before everything.** No subphase that touches the database may start until 1.2 (schema + migrations) is merged. The schema is the contract every other piece builds against.
2. **Formula module before anything that displays a score.** 1.3 must be complete and its tests green before 2.4 (rating screen), 4.x (dashboard), or the importer's score verification. Never re-implement the formula inline anywhere — one module, imported everywhere.
3. **Importer after schema + formula, before dashboard tuning.** The dashboard can be *built* against seed data, but 4.x exit criteria require real imported data, so 1.4 must land before Phase 4 sign-off.
4. **RCA schema (1.2) before RCA UI (3.x).** The tag tables ship in the initial schema even though the UI comes two phases later — avoids a mid-project migration that touches ratings.
5. **Design tokens before any styled UI.** 1.5 (tokens/typography/palette) precedes all UI subphases. Components built before tokens exist get rebuilt — don't.
6. **Within any single subphase, do not split work** — subphases are the atomic unit of parallelism.

### Safe to parallelize

| Track A | Track B | Why safe |
|---|---|---|
| 1.3 formula module | 1.5 design tokens | Pure logic vs pure CSS; zero shared files |
| 1.4 importer | 2.1 TMDB proxy layer | Both consume the schema, touch disjoint code |
| 2.2 add-film flow | 2.3 library views | Separate routes; both read-only against schema |
| 3.1 RCA CRUD/API | 3.2 multi-select component | Component can be built against mock data, wired in 3.3 |
| 4.1 stats queries | 4.4 chart primitives | Query layer vs presentational SVG; meet in 4.2/4.3 |
| Any phase's last subphase | Next phase's *-.1 (foundation) subphase | Overlap one step, never more |
| 5.2 keyboard shortcuts | 5.3 export | Fully independent features |

### General guidelines

- **One writer per file.** If two parallel tracks would edit the same file (e.g. the shared `db/schema.ts`), they are not actually parallel — sequence them or split the file first.
- **Mocks are the decoupler.** UI subphases may start against fixture data whenever their API counterpart isn't done, but the wiring step is a named subphase and counts as sequential work.
- **Never parallelize a migration with anything.** Any subphase containing a DB migration runs alone, lands, and is verified before dependent tracks resume.
- **Tests land with the subphase, not after.** A subphase without its tests is not done, and its dependents may not start.

---

## Phase 1 — Foundation & Data

Goal: a running skeleton with the schema, the exact rating math, imported real data, and the design system's raw materials. Nothing user-facing yet beyond a dev homepage.

### 1.1 Project scaffold
- `create-next-app` (App Router, TypeScript, Tailwind), ESLint/Prettier, `.env` handling (`TMDB_API_KEY`), `.gitignore` including the SQLite file and `.env`.
- Drizzle + better-sqlite3 wired with a `db/` module; drizzle-kit migration scripts in `package.json`.
- Folder conventions: `src/lib` (pure logic), `src/db`, `src/app/api`, `src/components`.
- **Exit:** `npm run dev` serves a page; `npm run db:migrate` runs cleanly on an empty database.

### 1.2 Schema & migrations  ⛔ blocks nearly everything
- All tables from PLAN.md §2: `films`, `ratings`, `watch_log`, `franchises` (self-referencing two-level tree), `rca_tags`, `film_rca_tags`, `settings`.
- Enums as check constraints (`status`, `polarity`, `attribute`); unique index on `tmdb_id`; indexes on `status`, `last_watch_date`, rating `overall`.
- Seed script: settings row with the default weights `{story:5, direction:5, writing:5, acting:5, music:2, impact:4, rewatchability:10(offset −50), genreFit:3, divisor:334}` and the rubric text from the Rating Scale tab.
- **Exit:** migration applies from zero; seed populates weights + rubric; Drizzle types compile.

### 1.3 Rating formula module  ⛔ blocks all score display
- `src/lib/scoring.ts`: `computeOverall(scores, weights)` and `computeSecondary(quality, rewatchability, genreFit)` — pure functions, weights injected (from `settings`), `max(0, …)` clamp included.
- `rankFilms(list)` reproducing the sheet's RANK semantics (competition ranking, ties share rank).
- Unit tests pinning known spreadsheet rows to 3 decimals: Jurassic Park → 9.988023952, The Two Towers → 9.745508982, Good Will Hunting → 9.580838323, plus a clamp case and a tie-rank case.
- **Exit:** tests green; module has zero imports from app code (pure).

### 1.4 Spreadsheet importer
- 1.4a **Parser:** accepts the sheet exported as `.xlsx` (CSV export only carries tab 1 — document this in the importer README). Reads the Films tab; converts serial dates; splits `Genre` on ` - ` into primary/secondary; maps Category → status; builds the franchise tree from Upper/Lower columns.
- 1.4b **Dry run:** CLI (`npm run import -- --dry-run file.xlsx`) printing a diff-style preview: rows to create, unparseable rows, franchise tree, status counts.
- 1.4c **Commit + verify:** writes films/ratings/franchises, seeds `watch_log` from `last_watch_date` (one entry, `is_rewatch=false`), then auto-verifies: status counts match (expected 365/355/63), recomputed overalls match the sheet's stored values to 3 decimals, recomputed ranks match the sheet's Ranking column. Verification failures abort with a report; the import is wrapped in a transaction.
- **Exit:** real sheet imports clean; verification report all-green.

### 1.5 Design tokens & typography  ⛔ blocks all styled UI
- Tailwind theme extension: charcoal base scale (warm near-black, ~4 surface steps), one accent (muted amber or oxblood — pick once, use everywhere), desaturated score scale (not green/red), hairline border color.
- Fonts: display serif (Fraunces or Newsreader) + neutral grotesk for UI, self-hosted via `next/font`; tabular numerals enabled for tables/scores.
- Base primitives only: page shell, hairline rule, button, input, table skeleton — 2–4px radii, borders not shadows.
- A `/dev/tokens` page rendering the whole system for visual review.
- **Exit:** tokens page reviewed; no hardcoded colors permitted outside the theme from here on.

---

## Phase 2 — Library & Rating

Goal: daily-driver core — find a film via TMDB, add it, browse the library, rate it.

### 2.1 TMDB proxy layer
- Server routes: `/api/tmdb/search?q=` (proxies `/search/movie`) and `/api/tmdb/movie/[id]` (`append_to_response=credits`, extracts director, runtime, genres). API key stays server-side.
- Response mapping to internal types; 15-minute in-memory cache on search; graceful 429/timeout handling.
- TMDB attribution component (logo + required disclaimer) in the footer.
- **Exit:** both routes return mapped JSON; key absent from client bundle.

### 2.2 Add-film flow
- Search-as-you-type modal (debounced): poster thumb, title, year, director per result.
- Selecting a result fetches full details, caches metadata into `films` (poster/backdrop paths, runtime, director, overview, tmdb_genres), prompts for: status, your genre (primary/secondary — autocomplete from existing values), franchise (create-inline), watch-order if To Watch.
- Manual-entry fallback form for films TMDB lacks (title/year required, everything else optional).
- Duplicate guard on `tmdb_id` and on title+year for manual entries.
- **Exit:** can add a TMDB film and a manual film; duplicates rejected with a useful message.

### 2.3 Library views
- 2.3a **Table view (Watched):** dense, sortable on every column (rank, title, year, each attribute, overall, last watch); live rank recompute via `rankFilms`; tabular numerals; sticky header.
- 2.3b **Poster grid** alternative toggle.
- 2.3c **To Watch view:** ordered by `watch_order`, drag-to-reorder persisting order; To Re-Watch view (simple list, last-watch shown).
- 2.3d **Filters + search:** genre, franchise, year range, overall range; full-text over title+notes; filter state in the URL (shareable/back-button-safe). RCA-tag filter slot stubbed (enabled in 3.4).
- **Exit:** all three statuses browsable; sort/filter/search work against imported data; reorder persists.

### 2.4 Film detail & rating screen  (requires 1.3, 1.5)
- Hero: TMDB backdrop under a heavy dark scrim + grain, poster, metadata block.
- Eight 0–100 attribute sliders + Quality; **live Overall** recomputing on drag, with a per-attribute contribution readout (each term of the formula visible).
- Save persists to `ratings` (creates or updates); rating a To Watch film prompts to flip status to Watched and log a watch.
- Watch log section: add dated watches, mark rewatches, edit/delete entries.
- Notes editor; status changer; RCA multi-select slots stubbed (wired in 3.3).
- **Exit:** rate a film end-to-end; overall matches `scoring.ts` exactly; watch log CRUD works.

---

## Phase 3 — RCA System

Goal: structured "why" tags per attribute, multi-selectable, filterable.

### 3.1 Tag management (CRUD + API)
- API routes for `rca_tags`: create/rename/delete (delete warns with usage count and cascades `film_rca_tags`); fields: label, bound attribute (one of the eight or `overall`), polarity, optional color.
- Settings-area management page: tags grouped by attribute, usage counts, merge-two-tags utility.
- Starter seed (~4 tags per attribute) so dropdowns aren't empty; all deletable.
- **Exit:** full CRUD via UI; merge works; usage counts accurate.

### 3.2 Multi-select component  (parallel with 3.1 against mock data)
- Type-ahead multi-select dropdown: checkbox list scoped to one attribute's tags, selected tags as removable chips, **create-new-inline** ("＋ Create 'weak third act'") without leaving the flow, full keyboard support (arrows/enter/escape), polarity shown subtly per tag.
- Styled from 1.5 tokens; built in isolation on `/dev/components` with fixtures.
- **Exit:** component handles select/deselect/create/keyboard; visual review passed.

### 3.3 Wiring into the rating screen  (requires 3.1 + 3.2)
- One multi-select per attribute row + one for Overall on the film detail screen; persists to `film_rca_tags` with the rating save (same transaction).
- Tags render read-only on the film page when not editing.
- **Exit:** tag a film per-attribute; selections survive reload; inline-created tags appear in 3.1's manager.

### 3.4 RCA filtering in the library
- Enable the stubbed library filter: match any/all selected tags; tag chips visible in table rows (compact) and film hovers.
- **Exit:** filter by one or several tags, combined with genre/year/score filters.

---

## Phase 4 — Dashboard, Trends & Streaks

Goal: everything the Rating Distribution tab did, plus what the sheet couldn't do. Sign-off requires real imported data (1.4).

### 4.1 Stats query layer  ⛔ blocks 4.2/4.3 wiring
- `src/lib/stats.ts`: pure/parameterized queries — overall-score histogram (0.5 buckets) + expected-distribution comparison, watches per month/year with rolling average, per-attribute averages, per-genre and per-decade count+average, franchise report cards, attribute↔overall correlations, RCA tag frequencies (overall and per attribute, average attribute score per tag).
- Unit tests against a fixture dataset with hand-computed expected values.
- **Exit:** every dashboard number comes from this module; tests green.

### 4.2 Streak engine + calendar
- 4.2a **Engine** (`src/lib/streaks.ts`): current/longest streaks at day, week, and month granularity from `watch_log`; optional weekly goal with pace status. Edge-case tests: gaps, multiple watches per day, timezone/DST-safe date math, year boundaries.
- 4.2b **Calendar heatmap:** year-grid of watch days styled to the token palette (charcoal→accent ramp, hairline grid — explicitly not GitHub-green); hover shows the films watched that day; year switcher.
- **Exit:** engine tests green; heatmap matches `watch_log` exactly.

### 4.3 Dashboard pages  (requires 4.1; charts from 4.4)
- 4.3a **Overview:** headline stat row (total watched, this month/year, current streaks, mean overall), distribution histogram vs expected curve, watches-per-month bars with rolling average.
- 4.3b **Deep-dive sections:** attribute radar/profile, genre breakdown, decade breakdown, franchise report cards, correlation nuggets ("Impact predicts your Overall best"), RCA analytics ("*weak third act* on 14 films; those films average 61 Writing").
- Charts link into the filtered library (click the Horror bar → library filtered to Horror).
- **Exit:** spot-check five dashboard numbers against manual SQL on real data; all charts clickthrough correctly.

### 4.4 Chart primitives  (parallel with 4.1)
- Small custom SVG chart kit (or thin visx wrappers): bar, histogram+overlay curve, radar, heatmap cell grid, sparkline — direct labeling over legends, no gradient fills, token palette, consistent axis/tick typography.
- Built on `/dev/components` with fixtures.
- **Exit:** each primitive renders fixtures correctly in a visual-review pass.

### 4.5 Rubric page
- The 0–10 scale with meanings and example films, editable in place (persists to `settings`); linked from every rating screen near the Overall readout.
- **Exit:** edits persist; link present on rating screens.

---

## Phase 5 — Polish & Hardening

### 5.1 Design pass
- Screen-by-screen audit against PLAN.md §7 and the anti-goal list (no gradients/glassmorphism/heavy shadows/over-rounding); spacing/hierarchy consistency; empty, loading (skeletons, not spinners-everywhere), and error states for every view; responsive check down to tablet width.
- **Exit:** every screen reviewed with fixes applied; empty states exist for a brand-new database.

### 5.2 Keyboard shortcuts & quick actions  (parallel with 5.3)
- `/` focuses search anywhere; `a` opens quick-add; `1–3` switch library status views; arrow-key row navigation in the table, `Enter` opens the film; `?` shows a shortcut overlay.
- **Exit:** all shortcuts work and are discoverable via the overlay.

### 5.3 Export & backup  (parallel with 5.2)
- CSV export mirroring the original sheet's columns (round-trip friendly) + full JSON export (films, ratings, watch log, tags, franchises, settings).
- One-command SQLite backup script (timestamped copy); restore documented in the README.
- **Exit:** exports open clean in a spreadsheet; backup/restore verified once end-to-end.

### 5.4 Final verification
- Re-run importer verification against the live sheet one last time; run the full test suite; manual end-to-end pass: add via TMDB → rate with RCAs → appears in dashboard/streaks → export includes it.
- Lighthouse/perf sanity on the library table with all ~720 films (virtualize rows if needed).
- **Exit:** all green; the spreadsheet can be retired.

---

## Dependency summary

```
1.1 → 1.2 → { 1.3, 1.4, 1.5, 2.1 }
1.3 → 2.4, 4.1
1.4 → (Phase 4 sign-off)
1.5 → all styled UI (2.2–2.4, 3.2, 4.2b–4.4, 5.1)
2.1 → 2.2
{2.2, 2.3} parallel → 2.4
{3.1, 3.2} parallel → 3.3 → 3.4
{4.1, 4.4} parallel → 4.2, 4.3
{5.2, 5.3} parallel; 5.1 → 5.4 last
```
