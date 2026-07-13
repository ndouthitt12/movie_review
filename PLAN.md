# Film Rating Site — Build Plan

A personal, single-user web app that replaces the "Movie Watchlist" spreadsheet: track watched / to-watch / to-re-watch films, rate them across weighted attributes, pull metadata from a free movie API, and visualize trends, distributions, and streaks — in a dark, editorial design.

---

## 1. What the spreadsheet does today (source of truth)

Pulled from the **Films** tab (~720 real rows):

| Column | Notes |
|---|---|
| Last Watch Date | Serial date; drives streaks/trends |
| ToWatchOrder | Manual priority for the watchlist |
| Ranking / Rk2 | Computed ranks from the two overall scores |
| Release Year | |
| Movie Title | |
| Category | `Watched` (365), `To Watch` (355), `To Re-Watch` (63) |
| Genre | Compound string, e.g. `Horror - Thriller`, `Action - SciFi` (primary + secondary) |
| Upper Franchise / Lower Franchise I | Two-level franchise grouping (e.g. series → sub-trilogy) |
| Notes | Freeform (e.g. "Approximate first watch date") |
| **Attribute scores (0–100)** | Story, Direction, Writing, Acting, Music, Impact, Rewatchability, Genre-fit |
| Overall (0–10) | Weighted formula — see below |
| Quality / Rewatchability / Genre (alt block) | Simplified 3-factor score |

**Primary overall formula** (weights preserved exactly):

```
Overall = max(0, (Story×5 + Direction×5 + Writing×5 + Acting×5
                + Music×2 + Impact×4 + (Rewatchability−50)×10 + GenreFit×3) / 334)
```

**Secondary score:** `(Quality×5 + Rewatchability×4 + GenreFit×1) / 100`

**Rating Scale tab:** a 0–10 rubric with written meanings and example films (10 = "the perfect film", 5 = "the average film", 0 = Neil Breen territory). This becomes an in-app reference.

**Rating Distribution tab:** monthly watch counts with actual-vs-expected distribution — the site's analytics section supersedes this.

The site must reproduce all of this, not approximate it.

---

## 2. Core concepts & data model

SQLite database (see stack, §6). Tables:

### `films`
- `id` (PK), `tmdb_id` (nullable int, unique)
- `title`, `release_year`
- `status` — enum: `watched` | `to_watch` | `to_rewatch`
- `watch_order` (nullable int — only meaningful for `to_watch`)
- `last_watch_date` (nullable date)
- `genre_primary`, `genre_secondary` (nullable) — keep your custom taxonomy rather than TMDB's; TMDB genres stored separately as metadata
- `franchise_id` (nullable FK), `sub_franchise_id` (nullable FK)
- `notes` (text)
- TMDB-cached metadata: `poster_path`, `backdrop_path`, `runtime`, `director`, `overview`, `tmdb_genres` (json) — cached locally so the app works offline and respects API terms

### `ratings` (1:1 with watched films, but separate table so re-rating history is possible later)
- `film_id` (FK)
- `story`, `direction`, `writing`, `acting`, `music`, `impact`, `rewatchability`, `genre_fit` — ints 0–100
- `quality` (for the secondary score block)
- `overall` and `overall_secondary` — **computed in app code with the exact formulas above**, stored for query speed
- `rated_at`

### `watch_log`
- `film_id`, `watched_on` (date), `is_rewatch` (bool)
- The spreadsheet only keeps *last* watch date; this table lets every watch count toward streaks and monthly stats. Migration seeds it from `last_watch_date`.

### `franchises`
- `id`, `name`, `parent_id` (nullable self-FK) — models Upper/Lower franchise as a two-level tree (e.g. *MCU* → *Infinity Saga*)

### RCA tags (see §5)
- `rca_tags`: `id`, `label`, `attribute` (enum: story/direction/…/overall), `polarity` (`positive` | `negative` | `neutral`), `color` (optional)
- `film_rca_tags`: `film_id`, `rca_tag_id` (many-to-many)

### `settings`
- Attribute weights (default = spreadsheet weights) so the formula is tweakable without a code change; changing weights recomputes all stored overalls.
- Rating rubric text (the 0–10 meanings + example films), editable.

---

## 3. Movie database API — TMDB

**Use TMDB (themoviedb.org).** Free for personal use, excellent search, posters/backdrops, no OAuth complexity (single API key), generous rate limits (~50 req/sec). OMDb is the fallback but has a 1,000/day cap and worse images.

Integration:
- **Search-as-you-type** when adding a film: query `/search/movie`, show poster thumbnails + year + director so you pick the right one in one click.
- On selection, fetch `/movie/{id}?append_to_response=credits` once and **cache everything locally** (poster downloaded or hot-linked per TMDB CDN rules, director from credits, runtime, synopsis, official genres).
- Manual-entry escape hatch for films TMDB doesn't have.
- API key lives in `.env`, never in client code — requests proxied through the app's server routes.
- Attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB" + logo in the footer (required by their terms).

---

## 4. Features

### 4.1 Library
- **Three views**: Watched (rankable table + poster grid), To Watch (drag-to-reorder honoring `watch_order`), To Re-Watch.
- **Table view** mirrors the spreadsheet: sortable by any attribute, overall, rank, year, last-watch date. Rank recomputes live like the `RANK()` formulas.
- Filters: genre (primary/secondary), franchise, year range, score range, RCA tags.
- Full-text search across titles and notes.

### 4.2 Film detail / rating screen
- Backdrop hero from TMDB, poster, metadata.
- **Eight attribute sliders (0–100)** with the live-computed Overall updating as you drag — the weighted formula made visible (show each attribute's contribution).
- Secondary quality-score block.
- RCA multi-select per attribute (§5).
- Watch log: add a watch date, mark rewatches.
- Notes.

### 4.3 Dashboard (aggregates & trends)
- **Rating distribution** histogram of Overall scores against the "expected" curve (replacing the Rating Distribution tab).
- **Films watched per month/year** — bar chart with rolling average.
- **Attribute radar / profile**: your average Story vs Acting vs Music etc. — reveals what you actually value vs the weights.
- **Genre breakdown**: count + average rating per genre; best/worst genres.
- **Decade breakdown** of watched films and ratings.
- **Franchise report cards**: average score per franchise, ranked.
- **Correlation nuggets**: e.g. which attribute best predicts your Overall; runtime vs rating.
- **RCA analytics**: most common tags overall and per attribute ("weak third act" appears on 14 films…).

### 4.4 Streaks
- **Current & longest watch streaks**: consecutive days, weeks, and months with ≥1 logged watch (computed from `watch_log`).
- Streak calendar — a year-grid heatmap of watch days (GitHub-contribution style, but styled to the design system in §7, not green squares).
- Optional weekly goal ("N films/week") with pace indicator.

### 4.5 Rating rubric page
- The 0–10 scale meanings and example films, editable in-app, linked from every rating screen.

### 4.6 Import & export
- **One-time migration**: importer for the Google Sheet (export it as .xlsx / CSV) mapping every column above; dry-run preview before commit. Also TMDB-matches each imported title (year+title) and asks for confirmation on ambiguous matches.
- Ongoing: CSV/JSON export of everything, so data is never trapped.

---

## 5. RCAs (root-cause annotations)

The reasons *behind* a score, structured instead of buried in notes.

- You define a library of RCA tags, each bound to an attribute (or to Overall), e.g. for **Writing**: `flat dialogue`, `plot holes`, `great twist`; for **Music**: `iconic theme`, `forgettable score`; for **Impact**: `stayed with me for days`.
- Tags carry a polarity so analytics can distinguish praise from criticism.
- On the rating screen, each attribute row has a **multi-select dropdown** (type-ahead, checkboxes, create-new-inline) showing only that attribute's tags; an "Overall" multi-select sits with the overall score.
- Tags are filterable in the library and aggregated on the dashboard (most frequent causes, per-attribute breakdowns, "films tagged `weak third act` average 61 in Writing").

*Assumption:* "RCA" = root-cause analysis, i.e. structured "why" tags per attribute. If you meant something else by RCA, this section is the one to revise — the model (labelled multi-select tags scoped to attributes) likely still fits.

---

## 6. Tech stack

Deliberately small — one process, no accounts, no cloud dependency:

- **Framework:** Next.js (App Router) + TypeScript — server routes proxy TMDB and hide the API key; one deployable unit.
- **DB:** SQLite via Drizzle ORM (typed schema, easy migrations). File lives alongside the app; trivially backed up.
- **Styling:** Tailwind CSS with a custom design-token layer (§7). No component library — hand-built components to avoid the stock look.
- **Charts:** Custom SVG/D3-style charts (or lightweight `visx`) rather than an off-the-shelf chart theme, so charts share the site's typography and palette.
- **State/data:** React Server Components + a thin client layer (TanStack Query) for interactive views.
- **Validation:** Zod on all API routes; rating math lives in one shared pure module with unit tests pinning the formulas to spreadsheet values.
- **Hosting:** runs locally (`npm run dev`) or on any small host; single-user, no auth needed initially (add a simple passphrase if ever exposed publicly).

---

## 7. Design direction — dark, editorial, not "AI-slop"

Explicit anti-goals: no purple-to-blue gradients, no glassmorphism cards floating on radial glows, no emoji-in-headings, no rounded-2xl-shadow-xl-on-everything, no Inter-with-gradient-text hero.

Direction — think *letterboxd meets a Criterion booklet*:

- **Palette:** near-black warm charcoal base (`#121110`-ish, not pure black), ink-grey surfaces, a single restrained accent (e.g. muted amber or oxblood) used only for interactive/emphasis moments; scores rendered in a quiet desaturated scale, not traffic-light green/red.
- **Typography-led:** a strong serif or humanist display face for titles (e.g. Fraunces, Newsreader) paired with a neutral grotesk for UI; generous line-height; numerals in tabular figures for tables and scores.
- **Film-first imagery:** TMDB posters and backdrops carry the visual weight; UI chrome stays recessive. Backdrops treated with a heavy dark scrim + subtle grain so text always sits comfortably.
- **Density where it matters:** the library table is genuinely dense (spreadsheet users like you want rows, not cards); dashboard breathes more.
- **Structure over decoration:** hairline rules (1px, low-contrast) and spacing do the layout work; borders/dividers instead of drop shadows; corners barely rounded (2–4px) or square.
- **Charts** share the same ink/accent palette, no gradients fills, labeled directly instead of legend-heavy.
- **Motion:** minimal — 150ms ease on hovers, slider thumb, and number tick-ups. Nothing parallaxes.

---

## 8. Build phases

**Phase 1 — Foundation & data**
Scaffold Next.js + Tailwind + Drizzle; schema + migrations; rating-formula module with tests pinned against known spreadsheet rows (e.g. Jurassic Park → 9.988); spreadsheet importer with dry-run.

**Phase 2 — Library & rating**
TMDB search + add flow; library table/grid with the three status views and drag-order watchlist; film detail page with sliders, live overall, watch log, notes.

**Phase 3 — RCA system**
Tag CRUD, per-attribute multi-select component, tag filters in the library.

**Phase 4 — Dashboard, trends, streaks**
All §4.3 charts, streak engine + calendar heatmap, rubric page.

**Phase 5 — Polish**
Design pass across every screen against §7; keyboard shortcuts (quick-add, `/` search); CSV/JSON export; empty/loading/error states; seed backup script for the SQLite file.

**Verification throughout:** after import, spot-check totals against the sheet (365 watched / 355 to-watch / 63 to-re-watch; ranks match the sheet's RANK columns; overall scores match to 3 decimals).

---

## 9. Open questions (defaults chosen, flag if wrong)

1. **RCA meaning** — assumed root-cause tags per attribute (§5).
2. **Genre taxonomy** — assumed you keep your own `Primary - Secondary` scheme with TMDB genres stored as extra metadata, not replacing yours.
3. **Rewatch history** — the sheet only stores last watch date; the plan upgrades to a full watch log. Fine?
4. **Books tab** — the sheet also tracks books; out of scope here, but the schema (media table + ratings) could later generalize if you want one app for both.
5. **Hosting** — assumed local-first. If you want it reachable from your phone, we'd add a passphrase and deploy to a small VPS/Fly.io.
