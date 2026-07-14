# GUI Redesign Plan — "CineView" Dark-Gold Theme

**Audience:** a frontier AI agent executing this plan end-to-end.
**Goal:** restyle the existing app to closely match two reference mobile screenshots (a public Home / movie-detail screen and an Admin overview dashboard) with a premium dark, gold-accented cinematic look. This is a *visual* redesign — do not change data models, routes' server logic, API handlers, or the rating formula. Reuse existing data flow; only change markup, styles, and presentational components.

---

## 0. Ground rules (read first)

1. **This repo runs a non-standard Next.js.** Before writing any code, read the relevant guides in `node_modules/next/dist/docs/` (App Router docs under `01-app`). APIs and conventions may differ from training data. Heed deprecation notices. This instruction comes from `AGENTS.md` and is mandatory.
2. **Stack:** Next.js App Router, Tailwind CSS v4 (CSS-first `@theme inline` config in `src/app/globals.css` — there is no `tailwind.config.js`), TypeScript, Drizzle/SQLite. Fonts load via `next/font` in `src/app/layout.tsx`.
3. **Branding:** the app is called **Picture House**, not CineView. Reproduce the screenshots' *style* — including the two-tone wordmark treatment ("Picture" in white serif + "House" in gold serif) — but keep the existing name and all existing copy/data. Do not invent fake stats, fake reviewers, or placeholder movies; bind every widget to the real data already rendered on each page.
4. **Verify as you go:** run the dev server (`npm run dev`) and check pages in the browser. Run `npm run lint` and `npx tsc --noEmit` before declaring any phase done.
5. **Commit per phase** on a feature branch (e.g. `gui/cineview-theme`), with clear messages.

---

## 1. Target design language (extracted from the screenshots)

### 1.1 Palette (replace the current orange/green/blue Letterboxd-style palette)

| Token | Value | Use |
|---|---|---|
| `--color-ink-950` | `#0a0a0a` (near-black) | page background |
| `--color-ink-900` | `#141414` | card/panel background |
| `--color-ink-850` | `#1c1c1e` | nested tile background (stat tiles, list rows) |
| `--color-ink-800` | `#26262a` | hairlines/borders, inactive progress tracks |
| `--color-paper-100` | `#f5f5f4` | primary text |
| `--color-paper-300` | `#a8a8a6` | secondary text |
| `--color-paper-500` | `#6f6f6e` | tertiary/labels |
| `--color-accent-400` | `#e8b451` (warm gold) | stars, wordmark accent, active tab underline, chart line, links like "View all", primary icons |
| `--color-accent-500` | `#c99a3d` | gold hover/pressed |
| `--color-positive` | `#4ade80` (soft green) | "+18 this week" deltas, Operational dots, verified badges may stay gold |
| `--color-sky` | keep for info states only | rarely used |

Keep the token *names* used across the codebase (`ink-*`, `paper-*`, `accent-*`, `positive`, `hairline`) so existing utility classes keep working — change only the values in `@theme inline`. Then sweep for places that hard-code the old semantics (e.g. green hover glows on posters, green `::selection`, green `accent-color` on range inputs) and move them to gold.

### 1.2 Shape, depth, typography

- **Radius:** generous — cards ~16px, nested tiles ~12px, pills/chips fully rounded. Change `--radius-ui` from `4px` to `12px` and add `--radius-card: 16px`.
- **Cards:** flat fills (`ink-900`) with a subtle 1px border (`ink-800`); no heavy shadows, no translucent blur panels. Rework the `.panel` class accordingly and remove the body radial-gradient/backdrop treatment in `globals.css` — the screenshots are pure near-black.
- **Typography:** two families —
  - **Serif display** (wordmark "CineView", featured movie titles like "Dune: Part Two"): load a serif via `next/font` (e.g. `Source Serif 4` or `Playfair Display`) as `--font-display`; wire `--font-serif` to it in the theme.
  - **Sans** for everything else: keep IBM Plex Sans or switch to `Inter`; either is close enough.
  - Section headers are small, letter-spaced uppercase in `paper-500` (the existing `.eyebrow` class already does this — keep it, retint).
- **Stars:** 5-star row with half-star support, gold fill, `ink-800` empty. Score shown as a decimal (e.g. `4.6`) beside the stars. Build one `<Stars value={n} outOf={5}/>` component and reuse everywhere. (This app scores 0–10 internally — display `score/2` stars alongside the raw number; do not change stored data.)

### 1.3 Recurring patterns to implement as shared components (`src/components/ui/`)

- `StatTile` — icon (gold), big number, label, small green delta line ("+18 this week" with ↑). Used in 2×2/4-up grids.
- `SectionCard` — rounded card with an eyebrow header row and optional gold "View all ›" link on the right.
- `ListRow` — leading icon or poster thumb, title, trailing value + chevron (used for "Content Pending", quick actions, recent reviews).
- `Stars` — as above.
- `Pill` — rounded-full filter chip; active = gold outline + gold text on transparent, inactive = `ink-850` fill.
- `TabBar` (page-level tabs) — horizontal text tabs, active tab in white with a 2px gold underline; inactive `paper-500`.
- `BottomNav` — fixed bottom bar (mobile only, `md:hidden`): 5 icon+label items, active item gold. Desktop keeps the existing top header. Items: Home, Discover→Library, Reviews→Rubric, Watchlist→Library?status=to_watch, Profile→Dashboard (map to real routes; adjust labels to this app's nouns if clearer).
- `RatingBreakdown` — horizontal 5→1 bar chart: star count label, gold bar over `ink-800` track, right-aligned percentage.
- Icons: use inline SVGs or add `lucide-react` (check it isn't already a dependency; add if needed).

---

## 2. Current-state map (what exists, where)

- `src/app/globals.css` — Tailwind v4 theme tokens + global classes (`.panel`, `.eyebrow`, `.poster-frame`, `.page-heading`, etc.). **The core of the retheme.**
- `src/app/layout.tsx` — root layout, font loading, metadata.
- `src/components/page-shell.tsx` — sticky header + nav + footer used by public pages.
- Public pages: `src/app/page.tsx` (home), `src/app/library/page.tsx` + `src/components/library/*`, `src/app/films/[id]/page.tsx` + `src/components/film/*`, `src/app/dashboard/page.tsx` + `src/components/dashboard/*` + `src/components/charts/charts.tsx`, `src/app/rubric/page.tsx`.
- Admin: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, plus `admin/form`, `admin/scoring`, `admin/scale`, `admin/rca`, `admin/versions`, and `src/components/admin/*`; login at `src/app/admin-login`.
- Form controls: `src/components/{button,input,table}.tsx`, `src/components/form/*`.
- Dev galleries: `src/app/dev/tokens/page.tsx`, `src/app/dev/components/page.tsx` — useful to eyeball the retheme quickly.

Read each file before editing; the map above may be incomplete.

---

## 3. Execution phases

### Phase A — Foundation (ONE agent, sequential; everything else depends on it)

1. Read the Next.js docs noted in §0, then `globals.css`, `layout.tsx`, `page-shell.tsx`, and the dev token/component galleries.
2. Rewrite the `@theme inline` token values per §1.1–1.2; update `.panel`, `.eyebrow`, `body` background (flat near-black, remove gradients), `::selection` (gold), `:focus-visible` (gold), `.poster-frame` hover (gold), `.rating-range` accent (gold), status dots.
3. Add the serif display font in `layout.tsx`; expose as `--font-display`/`--font-serif`.
4. Build the shared UI kit of §1.3 in `src/components/ui/` with a small demo added to `src/app/dev/components/page.tsx`.
5. Restyle `PageShell`: two-tone serif wordmark (drop the three colored dots), gold hover states, add `BottomNav` for mobile, keep the footer/TMDB attribution.
6. Verify: dev server renders home, library, dashboard, admin without visual breakage; lint + typecheck pass. Commit.

### Phase B — Page restyles (PARALLEL — spawn three subagents after Phase A is committed)

Each subagent must: read §0/§1 of this plan, read its target files fully before editing, use the Phase A UI kit (extend it rather than fork it; coordinate by keeping additions generic), bind to existing real data only, keep server components server-side, and finish with lint + typecheck.

**Subagent B1 — Public home + film detail** (`src/app/page.tsx`, `src/app/films/[id]/page.tsx`, `src/components/film/*`)
Match screenshot 1:
- Hero "FEATURED" card: poster left (rounded 12px), eyebrow "FEATURED" in gold, serif movie title, meta line "Genres • Year • Runtime" in `paper-300`, big gold star + large score `X.X / 5` (converted) with rating-count text, then the film's overview/notes as the quote block. Feature the most recently watched or top-ranked film — whichever the current home page already surfaces; don't invent a new query unless trivial.
- "RATING SUMMARY" card: huge gold score numeral (~64px), `Stars` row, "Based on N ratings" caption on the left; `RatingBreakdown` 5→1 bars on the right. For this single-user app, derive the breakdown from the library's score distribution for that film's genre or overall — use whatever aggregate data the page/dashboard already computes; if none fits, show the attribute scores (Story, Direction, …) as the bar rows instead, which is more honest to the data.
- Genre `Pill` filter row (All / top genres).
- "POPULAR REVIEWS" → repurpose as recent ratings/notes: 3-up horizontal cards with avatar/initial, name, stars, note excerpt, "Nd ago".
- "TRENDING NOW" → horizontally scrolling poster rail ("See all ›" → /library), posters rounded with title overlay only if artwork lacks titles.

**Subagent B2 — Admin dashboard** (`src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/components/admin/*`)
Match screenshot 2:
- Header: wordmark + big "Admin" heading; `TabBar` for the admin sections (Overview / Form / Scoring / Scale / RCA / Versions — map to the real admin routes; active tab gold-underlined).
- "OVERVIEW" `SectionCard` with 4 `StatTile`s bound to real counts (films, ratings, watches, avg score — reuse the queries behind the existing admin/dashboard pages).
- "RECENT REVIEWS"-style card → recent ratings/watch-log entries: poster thumb, title, `Stars` + score, date, overflow "⋮" (may be non-functional), gold "View all ›".
- Two-column section (stack on mobile): a "PENDING"/counts `ListRow` card (use whatever queue-like data exists — e.g. to-watch count, unrated watched films, RCA tags) and an "ACTIVITY (LAST 7 DAYS)" card with a big total, green delta, and a gold line/area chart with dot markers over the last 7 days (restyle the existing chart components in `src/components/charts/charts.tsx`).
- "SYSTEM STATUS" card (green dots, "Operational") — only include checks that are real (DB reachable, TMDB key configured); otherwise omit this card.
- "QUICK ACTIONS" card: `ListRow` links with gold icons to real admin actions (Add Film, Edit Form, Scoring, Rubric).

**Subagent B3 — Library, dashboard, rubric, forms** (`src/app/library`, `src/app/dashboard`, `src/app/rubric`, `src/components/{library,dashboard,charts,form}/*`, `button/input/table`)
- Apply the same card/tile/pill/star language: library filters become `Pill`s, film grid uses rounded posters with gold hover, tables restyled to `ink-900` rows with hairline dividers, dashboard charts retinted gold-on-dark with green deltas, rubric rows as `SectionCard` list.
- Restyle `button.tsx` (primary = gold fill w/ dark text, secondary = `ink-850` fill, ghost = text-only gold), `input.tsx`, `select-field`, sliders (gold accent), and the form components to match.

### Phase C — QA (ONE subagent, mandatory, after all B agents finish and commit)

Spawn a QA subagent with this brief:
1. Run lint + `tsc --noEmit` + any existing tests (`npx vitest run`).
2. Start the dev server; visit every route: `/`, `/library`, `/films/[id]` (pick a real id), `/dashboard`, `/rubric`, `/admin` and every admin subpage, `/admin-login`, `/settings/rca`, `/dev/tokens`, `/dev/components`.
3. At mobile (375px) and desktop (1280px) widths, screenshot each page and compare against §1's spec: flat near-black background, gold accents (no leftover orange `#ff8000`, green `#00e054` used only for deltas/status, blue `#40bcf4` gone from links), rounded cards, serif titles, working bottom nav on mobile, no horizontal overflow, readable contrast, no broken layouts or hydration/console errors.
4. Grep for stragglers: `#ff8000|#00e054|#40bcf4|text-sky|bg-positive|accent-300` outside intentional uses.
5. Fix small issues directly; report a punch list of anything larger. The main agent addresses the punch list, re-runs QA checks, and commits.

---

## 4. Explicitly out of scope

- No auth, schema, API, or rating-formula changes.
- No new fake data or hard-coded numbers in widgets.
- No renaming of routes; navigation labels may change, hrefs may not.
- Don't restyle `node_modules` or `.next` artifacts (obviously) and don't touch `scripts/` or `drizzle/`.
