# GUI Redesign Instructions — Match the "Reeler" Mockup 1:1

**Audience:** an AI coding agent (ChatGPT 5.6 Sol) working in this repository.
**Goal:** rebuild the home page (`src/app/page.tsx`) so a screenshot of it is visually indistinguishable from the reference mockup, then propagate the same visual language to every other page.

---

## 0. Ground rules (read first)

1. **Reference image.** The mockup is saved at `docs/mockup/home-mockup.png`. If that file does not exist, STOP and ask the user to place it there before continuing. Every visual decision must be checked against this image, not against memory.
2. **This is NOT the Next.js you know.** Per `AGENTS.md`, this repo uses a Next.js version with breaking changes. Before writing any code, read the relevant guides in `node_modules/next/dist/docs/` (routing, image, fonts, styling). Heed deprecation notices.
3. **Iterate visually.** You MUST run the dev server, take a screenshot at **1672×941** (the mockup's aspect) or 1920×1080 desktop, and compare it side-by-side against `docs/mockup/home-mockup.png`. Repeat: change → screenshot → compare → change, until no visible differences remain. Do not declare completion after a single pass. A minimum of 4–5 compare cycles is expected.
   - Use Playwright (`npx playwright screenshot`) or a headless browser script; save screenshots to `docs/mockup/progress/step-NN.png` so progress is auditable.
   - When comparing, check: layout geometry, spacing, font sizes/weights, colors (sample exact pixels), border radii, icon shapes, alignment of numbers/stars.
4. **Real data, mock fallback.** The app is data-driven (SQLite via `src/lib/catalog.ts`). The mockup shows specific movies (Dune: Part Two, Furiosa, etc.). Do NOT hardcode movie content into components — build the layout so the seeded/real library data flows into the mockup's slots. If the local DB is empty, run the seed script (`scripts/seed.ts`) first so the page has enough films to render every section.
5. **Preserve existing tokens where they already match.** `src/app/globals.css` already defines a dark ink/gold palette (`--color-ink-*`, `--color-accent-*`). Extend/adjust these tokens rather than inventing parallel ones. All new colors go through CSS variables.
6. **Branding:** the site's wordmark component is `src/components/ui/wordmark.tsx`. The mockup brand is "Reeler" in a gold serif logotype. Update the wordmark to match the mockup ("Reeler", serif, accent gold) unless the user has said otherwise.

---

## 1. Global frame (applies to home first, all pages later)

### 1.1 Background & typography
- Page background: near-black (`#0a0a0a`, already `--color-ink-950`).
- Body text: warm off-white (`#f5f5f4`) with muted gray secondary text (`#a8a8a6` / `#6f6f6e`).
- Accent: gold (`#e8b451` family) for logo, active nav underline, stars, score ring, bars.
- Display font: a serif (e.g. the existing `--font-display`) for the logo and the hero movie title. UI font: the existing sans (`--font-ui`).

### 1.2 Top navigation bar (replace whatever `PageShell` currently renders as header)
Full-width bar, ~68px tall, background same as page (or `#0a0a0a` with a subtle bottom hairline). Left → right:
1. **Logo** "Reeler" — gold serif, ~28px, left-aligned with page gutter (~48px).
2. **Nav links** (~15px, gray `#a8a8a6`): `Discover` (active — white/gold with a 2px gold underline sitting on the bar's bottom edge), `Reviews`, `Watchlist`, `Lists`, `News`. ~36px gap between links. Map these to the app's real routes (Discover → `/`, Watchlist/Lists → `/library`, etc.); keep the labels as in the mockup.
3. **Search bar** — center-right, pill/rounded rect (~10px radius), dark fill `#141414`, 1px hairline border, magnifier icon left, placeholder "Search movies, reviews, people…" in gray. Width ≈ 540px, height ≈ 44px.
4. **Bell icon** (outline, gray) with right margin.
5. **User chip**: circular avatar (32px), name "Ava Morgan" in white 14px, small chevron-down. (Wire to whatever user/account concept exists; static placeholder is acceptable if none.)

### 1.3 Page grid
Below the nav: a two-column layout inside ~48px page gutters with ~24px column gap:
- **Main column** (~74% width): hero, Trending Now, Popular Reviews.
- **Right sidebar** (~26%, ~380px): Top Critics, Genres, Recently Reviewed.

---

## 2. Home page — main column

### 2.1 Hero / Featured carousel
A single large rounded card (~16px radius) filling the main column, height ≈ 390px, using the featured film's **backdrop image** (TMDB backdrop via `tmdbImage` in `src/lib/tmdb.ts`) as background with a left-to-right dark gradient overlay (near-opaque `#0a0a0a` on the left fading to transparent ~60% across) so text is readable.

Left content block (padded ~56px left, vertically centered):
- Eyebrow: `FEATURED` — small caps, gold, letterspaced (reuse `.eyebrow` styling but gold).
- Title: film title in large serif, white, ~56px, bold (e.g. "Dune: Part Two").
- Meta row (gray 14px, dot separators): genres • year • runtime • rating cert (e.g. `Sci-Fi, Adventure • 2024 • 2h 46m • PG-13`).
- Synopsis: 3–4 lines, ~15px, light gray, max-width ~430px.
- Attribution line: `— The Hollywood Reporter` italic gray (use overview source or omit if unavailable — but match the visual slot).
- Buttons row: **Watch Trailer** — gold filled pill-ish rect (10px radius), dark text, play icon; **Add to Watchlist** — transparent with 1px light border, white text, `+` icon.

Right inside the hero: a **score panel** — a translucent dark rounded card (~16px radius, `rgba(20,20,20,0.7)` + blur), ~250px wide, containing:
- Circular progress ring (gold arc on dark track, ~110px) with the score `4.6` in large white text inside.
- `REELER SCORE` small caps gray label; verdict word (`Great`) below in gold.
- 5-star row (gold stars, fractional last star).
- `Based on 12,432 ratings` small gray text.
- **Ratings histogram**: 5 rows (`5…1` + tiny star icon), thin rounded gold bars on dark tracks, right-aligned percentage labels (`66% / 22% / 8% / 3% / 1%`). Compute from real rating data if available (`src/lib/stats.ts`); otherwise derive a plausible distribution from the film's score.

Carousel chrome: small left/right chevron buttons vertically centered on the hero's outer edges, and 4–5 dot page indicators centered below the hero (active dot gold/white). Featured items = most recent rated films (existing logic in `page.tsx` already picks `featured`; extend to a rotating list).

### 2.2 Trending Now
- Section header row: `TRENDING NOW` — bold small-caps ~15px white, left; `See all →` link in gray, right.
- A single row of **8 poster cards** (horizontally scrollable if fewer fit): rounded 12px posters, ~2:3 aspect, ~140px wide, with a bottom gradient overlay containing `★ 4.3`-style rating (gold star + white number, bottom-left).
- Data: newest/top films from `getLibraryFilms()` with posters (the existing `posters` slice).

### 2.3 Popular Reviews
- Header row like above: `POPULAR REVIEWS` + `See all →`.
- **4 equal cards** in a row, dark `#141414` rounded (16px) cards, 1px hairline border, padding ~20px:
  - Top row: 32px circular avatar, reviewer name (white 14px semibold) + blue/gold verified check, right-aligned relative timestamp (`2d ago`, gray 12px).
  - Star row: 5 small gold stars (fractional supported) under the name.
  - 3–4 lines of review text, gray `#a8a8a6`, ~13.5px, line-height ~1.55.
  - Bottom-right: heart outline icon + like count in gray.
- Data: if the app has watch notes/reviews (`watch-log`), use them; otherwise seed placeholder reviewers so the layout matches.

---

## 3. Home page — right sidebar

Each sidebar block is a `panel` card (`#141414`, 16px radius, 1px hairline, ~20px padding), stacked with ~20px gaps.

### 3.1 Top Critics
- Header: `TOP CRITICS` small-caps white left, `See all ›` gold link right.
- 5 rows separated by hairlines: 36px avatar, name (white 14px) + gold verified check, right-aligned score (`4.8`) in gold semibold. Row height ≈ 48px.

### 3.2 Genres
- Header: `GENRES`.
- Wrapping pill chips (rounded-full, dark `#1c1c1e` fill, 1px hairline, gray text 13px, ~8px vertical / 14px horizontal padding, 10px gaps): Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Horror, Sci-Fi, Thriller.
- Bottom-right: `View all` gray link.
- Data: `topGenres` already exists in `page.tsx` — extend to 10 or fall back to the static list.

### 3.3 Recently Reviewed
- Header: `RECENTLY REVIEWED`.
- 3 rows: small poster thumbnail (~56×56, rounded 8px), title (white 14px, wraps to 2 lines), below it `★ 4.0` gold + a small clock/runtime `2h 25m` gray.
- Footer: `View all activity` gold link, right-aligned.
- Data: `recentRatings` from the existing page logic.

---

## 4. Implementation plan (suggested order)

1. Read the Next.js docs in `node_modules/next/dist/docs/` for layout/Image/fonts.
2. Extend `globals.css` tokens if needed (translucent panel color, nav heights); add utility classes for the new patterns (score ring, histogram bar, poster card).
3. Rebuild `src/components/page-shell.tsx` header into the mockup nav (logo, links, search, bell, avatar). Keep it a shared component so all pages inherit it.
4. Rebuild `src/app/page.tsx` section by section: hero → trending → reviews → sidebar. Create new components under `src/components/home/` (e.g. `hero-carousel.tsx`, `score-panel.tsx`, `poster-card.tsx`, `review-card.tsx`, `critics-panel.tsx`).
5. Reuse existing primitives where they fit: `Stars` (`src/components/ui/stars.tsx`), `Pill`, `SectionCard`, `RatingBreakdown` (adapt for the histogram).
6. Seed the DB if empty so every section has content.
7. **Screenshot & compare loop** (mandatory): start dev server, screenshot at desktop width, open next to `docs/mockup/home-mockup.png`, list every visible difference, fix, repeat until the list is empty or the remaining differences are purely data-content (different movie titles/posters are OK; different layout/spacing/color/typography is NOT).
8. Responsive pass: the layout must degrade gracefully — sidebar drops below main at <1100px, trending row scrolls, review cards wrap 2×2 then 1-col. Screenshot at 768px and 375px too.
9. Run `npm run lint` and the test suite; fix regressions.

## 5. After the home page: other pages

Once the home page passes the visual comparison, restyle the remaining pages (`/library`, `/films/[id]`, `/dashboard`, `/rubric`, `/admin`, `/settings/rca`, `/admin-login`) to the same language: same nav, same panel cards, same typography scale, gold accents, poster cards, star components. No mockups exist for these — match the *style*, keep their existing functionality and information architecture intact. Screenshot each page and sanity-check it looks like a sibling of the new home page.

## 6. Definition of done

- [ ] Side-by-side screenshot vs `docs/mockup/home-mockup.png` shows matching layout, spacing, colors, and typography (content text may differ where data-driven).
- [ ] Progress screenshots saved in `docs/mockup/progress/`.
- [ ] No hardcoded movie data in components; page renders from the DB.
- [ ] All routes render without errors; lint and tests pass.
- [ ] Other pages share the nav and visual system.
