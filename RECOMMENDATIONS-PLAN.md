# Recommendations & Trending Algorithm + Interactive Home Page — Implementation Plan

**Audience:** an AI coding agent (ChatGPT 5.6 Sol) working in this repository.
**Goal:** power the home page with real algorithms AND make every visible element functional:
1. **Trending Now** — currently-popular movies, blended from TMDB trending data and this library's own activity.
2. **Recommended For You** — personalized movie recommendations derived from the user's own ratings, RCA tags, genres, directors, and watch history.
3. **Full interactivity** — the home page was built visually to match the mockup, but much of it is static placeholder chrome. Every button, link, chip, and card must do something real (Section 7).

---

## 0. Ground rules

1. **This is NOT the Next.js you know.** Per `AGENTS.md`, read the relevant guides in `node_modules/next/dist/docs/` (route handlers, caching/revalidation, server components) before writing code. Heed deprecation notices.
2. **This is a single-user app.** There is exactly one rating per film (`ratings.film_id` is unique). There is no user table and no collaborative filtering — recommendations are **content-based**, built from this one user's taste profile. Do not invent multi-user infrastructure.
3. **Follow existing conventions.** Business logic lives in `src/lib/` as pure, unit-tested functions (see `scoring.ts` + `scoring.test.ts` as the pattern). TMDB HTTP access goes through `src/lib/tmdb-server.ts`; response mapping through `src/lib/tmdb.ts` (`mapTmdbMovie`). DB access uses Drizzle via the existing patterns in `src/lib/catalog.ts`.
4. **Pure core, thin edges.** The scoring math must be pure functions that take plain data in and return ranked lists — no fetching or DB calls inside them — so they are fully unit-testable. Fetching/caching wraps around them.
5. **Write tests as you go.** Every scoring function gets a `.test.ts` sibling, matching the existing test style. Run the full suite before finishing.
6. **Graceful degradation.** The home page must render sensibly when: the TMDB API key is missing, TMDB is unreachable, the library is empty, or the user has rated < 5 films (cold start). Never let the home page 500 because a recommendation call failed.

---

## 1. Available signals (what the algorithm has to work with)

From `src/db/schema.ts` and `src/lib/`:

| Signal | Source | Use |
|---|---|---|
| Overall score (0–100 or scale in use) | `ratings.overall` (+ `overallSecondary`) | Like/dislike strength |
| Per-attribute scores (story, direction, writing, acting, music, impact, rewatchability, genre_fit) | `answers` joined through published-form `questions` (see `src/lib/recompute.ts` / `catalog.ts` for how attributes are derived) | What *dimensions* the user values |
| RCA tags with polarity (positive/negative/neutral) per attribute | `rca_tags` + `film_rca_tags` | Fine-grained taste reasons ("weak third act", "great score") |
| Genres | `films.genre_primary/secondary`, `films.tmdb_genres` | Genre affinity |
| Director | `films.director` | Director affinity |
| Franchise | `films.franchise_id` / `sub_franchise_id` | Franchise completion recs |
| Watch recency & rewatches | `watch_log`, `films.last_watch_date`, `status = 'to_rewatch'` | Recency weighting, rewatch candidates |
| Watchlist | `films.status = 'to_watch'` | Items the user already wants — rank them, and exclude from "new" recs |
| TMDB metadata | `tmdb-server.ts` (details endpoint) | Cast/crew/keywords/similar for candidate expansion |

TMDB endpoints to add to `tmdb-server.ts` (all documented at developers.themoviedb.org):
- `GET /trending/movie/{day|week}` — trending.
- `GET /movie/{id}/recommendations` and `/movie/{id}/similar` — candidate generation.
- `GET /discover/movie` — candidate generation by genre/people/keyword filters.
- `GET /movie/{id}` with `append_to_response=credits,keywords` — enrichment.

---

## 2. Architecture

```
src/lib/recs/
  taste-profile.ts       // build TasteProfile from library data (pure)
  taste-profile.test.ts
  candidate-score.ts     // score a candidate movie against a TasteProfile (pure)
  candidate-score.test.ts
  trending.ts            // blend TMDB trending with library signals (pure ranking core)
  trending.test.ts
  recommend.ts           // orchestrator: candidates -> filter -> score -> diversify (pure core)
  recommend.test.ts
src/lib/recs-server.ts   // server-only: fetch candidates from TMDB, read DB, call pure core, cache
src/app/api/recs/route.ts        // GET /api/recs      -> recommendations payload
src/app/api/recs/trending/route.ts // GET /api/recs/trending -> trending payload
```

Home page (`src/app/page.tsx`) consumes `recs-server.ts` directly in the server component (preferred over calling its own API routes); the API routes exist for client-side refresh and debugging.

### Caching
- TMDB trending/discover responses: cache server-side for **6 hours** (trending) and **24 hours** (discover/similar). Use the caching mechanism this Next.js version documents (check `node_modules/next/dist/docs/` — likely `revalidate` on fetch or an explicit cache API). Also memoize per-request.
- Taste profile: recompute on demand; it's cheap (single-user data). Invalidate any cached recommendations whenever a rating is created/updated (hook into the same paths that call `recompute.ts`).

---

## 3. Taste profile (`taste-profile.ts`)

Build a `TasteProfile` object from all rated films:

```ts
interface TasteProfile {
  genreAffinity: Record<string, number>;      // -1..+1 per genre
  directorAffinity: Record<string, number>;   // -1..+1 per director
  attributeWeights: Record<Attribute, number>; // how much each attribute predicts overall
  positiveTagThemes: Record<string, number>;  // RCA label -> weight
  negativeTagThemes: Record<string, number>;
  meanScore: number;                          // user's average overall
  ratedTmdbIds: Set<number>;
  watchlistTmdbIds: Set<number>;
  eraAffinity: Record<string, number>;        // by decade
  franchiseIds: Set<number>;                  // franchises with >=1 highly rated film
  sampleSize: number;
}
```

Computation rules:
- **Center scores.** Use `(overall - meanScore)` as the like/dislike signal, not raw scores — the user's personal scale matters, not absolute values.
- **Genre affinity** = weighted mean of centered scores for films in that genre, shrunk toward 0 for small counts (`affinity * n / (n + k)`, k ≈ 3) so one 5-star horror film doesn't make horror dominant. Combine `genre_primary` (weight 1.0), `genre_secondary` (0.6), and `tmdb_genres` (0.4 each).
- **Director affinity**: same shrinkage, k ≈ 1.5 (directors have few films).
- **Recency decay**: weight each film's contribution by `exp(-ageInDays / 730)` using `last_watch_date` — taste two years ago counts half.
- **Attribute weights**: correlate each attribute's centered score with centered overall across rated films (simple Pearson or covariance); normalize to sum to 1. This reveals whether the user is e.g. story-driven or visuals-driven. With < 8 rated films, fall back to uniform weights.
- **RCA themes**: for each positive-polarity tag on a highly-rated film, add weight; negative tags on low-rated films confirm dislikes. Keep the top ~20 of each.
- **Era affinity** by release decade, same shrinkage approach.

Unit tests: fixture library of ~10 hand-built films with known ratings; assert affinities have the expected sign and ordering, shrinkage behaves at n=1, recency decay applies, and empty/one-film libraries return a neutral profile.

---

## 4. Recommendation pipeline (`recommend.ts` + `recs-server.ts`)

### 4.1 Candidate generation (server, TMDB)
Gather ~150–300 candidates, deduplicated by TMDB id:
1. **Seed-based**: for the user's top ~10 rated films (recency-decayed score), fetch TMDB `/recommendations` and `/similar` (first page each). Tag each candidate with its seed film.
2. **Discover-based**: for the top 3 positive genres and top 3 directors, `/discover/movie` sorted by `vote_average` with a minimum `vote_count` (e.g. ≥ 200) to filter obscure noise.
3. **Franchise gaps**: unseen films in franchises the user rates highly (via TMDB collection data if available, else skip).
4. **Watchlist**: the user's own `to_watch` films are first-class candidates (they get ranked too, surfaced as "From your watchlist").

### 4.2 Filtering
Remove: already-rated films, already-watched films, films already in the library with status `watched`/`to_rewatch` (unless building the separate rewatch shelf), adult titles, and candidates missing a poster.

### 4.3 Scoring (`candidate-score.ts`, pure)
For each candidate compute a 0–100 match score:

```
match = 100 * sigmoid(
    w_genre    * genreScore        // mean of profile.genreAffinity over candidate genres
  + w_director * directorScore
  + w_seed     * seedScore         // max centered score of the seed film(s) that produced it
  + w_quality  * qualityScore      // TMDB vote_average normalized, shrunk by vote_count
  + w_era      * eraScore
  + w_recentRelease * releaseRecencyBonus  // small boost for last-2-years releases
)
```

Starting weights (make them a single exported constant so they're tunable): genre 0.30, seed 0.25, director 0.15, quality 0.20, era 0.05, recency 0.05. Document each in code.

Also produce **reasons**: each scored candidate returns `reasons: string[]` like "Because you rated *Dune: Part Two* 4.6", "You rate Denis Villeneuve films highly", "Matches your love of Sci-Fi". The UI will show the top reason.

### 4.4 Diversification
Pure greedy re-rank (MMR-style): walk the score-sorted list, penalizing a candidate by ~15% per already-picked film sharing its primary genre and ~30% if sharing a director, so the top 20 isn't ten sci-fi films. Deterministic — no randomness — so tests are stable.

### 4.5 Cold start — fall back to TMDB trending
When there is no personalization data, the recommendation pipeline does not guess — it serves TMDB trending data instead:

- **0 rated films (no personalization data at all)**: skip the taste profile, candidate generation, and scoring entirely. The "Recommended For You" slot shows the TMDB trending list (`/trending/movie/week`, same fetcher as Section 5) filtered only for already-in-library titles and missing posters, in TMDB's own order. Retitle the section header to "Trending This Week" or "Popular Right Now" — never claim personalization that isn't happening. No reasons are shown.
- **1–4 rated films**: personalization on, but blend with the TMDB trending ranking rather than pure popularity: `finalScore = personalWeight * matchScore + (1 - personalWeight) * trendingRankScore`, where `personalWeight = min(1, sampleSize / 10)`. As the user rates more films, trending influence fades out automatically.
- **≥ 5 rated films**: full personalization as specified above (trending influence continues to shrink via the same formula until `sampleSize` reaches 10).
- The same fallback applies at runtime, not just for empty libraries: if profile construction fails or yields a neutral profile (e.g. all films unrated), treat it as the 0-rated case.
- Encapsulate this switching in `recommend.ts` so callers (home page, `/api/recs`) get one function that always returns a usable list plus a `mode: "personalized" | "blended" | "trending"` field the UI uses to pick the section title.

---

## 5. Trending algorithm (`trending.ts`)

Blend two sources into one ranked "Trending Now" list of ~16 items:

1. **TMDB trending** (`/trending/movie/week`): base popularity signal. Normalize each film's `popularity` to a 0–1 rank score within the page.
2. **Library affinity tilt**: multiply by `(1 + 0.35 * genreAffinityScore)` from the taste profile — trending stays trending, but ties break toward the user's taste.
3. **Library overlap bonus**: if a trending film is already in the library (match on `tmdb_id`), keep it but badge it — watchlisted items get a small boost (the user is primed to care), already-rated items get demoted below unrated ones.
4. Filter: must have poster + backdrop; exclude adult.

Output shape per item: `{ tmdbId, title, posterPath, rating (TMDB vote_average on the site's display scale), inLibrary, badge? }`. The poster-card rating shown on the home page uses TMDB `vote_average` converted to the site's 5-point display (divide by 2, round to 1 decimal) for films not in the library, and the user's own rating for films that are.

Pure-core rule: `trending.ts` takes `(tmdbTrendingPage, tasteProfile, libraryIndex)` and returns the ranked list — fetching happens in `recs-server.ts`. Test with fixtures: affinity tilt reorders correctly, rated films sink, empty profile is a no-op passthrough.

---

## 6. Home page integration

1. **Trending Now** row: replace the current "newest posters from the library" slice with the blended trending list. Cards link to the film page if `inLibrary`, else to an "add to library" affordance (reuse `src/components/library/add-film-dialog.tsx` flow or a lightweight TMDB detail view — keep scope minimal: linking out or opening the existing add dialog prefilled is enough).
2. **New "Recommended For You"** section: add a row (same poster-card component as Trending) between Trending and Popular Reviews, showing the top ~8 recommendations with their top reason as a subtitle on hover or beneath the card. Include a "From your watchlist" chip on watchlist items.
3. If TMDB is unavailable, hide the Recommended section and fall back to the current library-poster behavior for Trending — the page must never break.
4. Match the established mockup visual style exactly (see `GUI-REDESIGN-INSTRUCTIONS.md`): same poster cards, section header pattern (`RECOMMENDED FOR YOU` + `See all →`), gold accents.
5. **Visual verification loop (mandatory):** run the dev server, screenshot the home page, and confirm the new sections render populated, aligned, and styled like the rest of the page. Iterate screenshot → fix until clean, saving progress shots to `docs/mockup/progress/`.

---

## 7. Make every home-page element interactive

The home page currently matches the mockup visually, but many elements are static placeholders. Audit `src/app/page.tsx`, `src/components/page-shell.tsx`, and the `src/components/home/` components; every clickable-looking element must perform a real action. Do NOT add features the app doesn't have a backend for — where the mockup implies a multi-user social feature (e.g. critic profiles), repurpose the element to the nearest real equivalent, listed below.

### 7.1 Top navigation
- **Logo** → links to `/`.
- **Nav links** → map to real routes: Discover → `/`, Watchlist → `/library?status=to_watch`, Lists → `/library`, Reviews → `/library?sort=recently_rated` (or the closest existing library view; add query-param support to `library-view.tsx` if missing). If a label has no sensible target (e.g. News), either link it to `/dashboard` or remove it — no dead links. Active link state must follow the current route (use the pathname hook this Next.js version documents).
- **Search bar** → make it live. On typing (debounced ~300ms), show a dropdown with two groups: **In your library** (client-side or API match on film titles, linking to `/films/[id]`) and **On TMDB** (via the existing `/api/tmdb/search` route), where selecting a TMDB result opens the existing add-film flow (`add-film-dialog.tsx`) prefilled. Keyboard support: arrows + Enter + Escape. This becomes a client component; keep it self-contained so the shell stays a server component.
- **Bell icon** → wire to something real and cheap: a dropdown listing recent library activity (last few watches/ratings from `watch_log`), or remove it. No dead button.
- **User chip** → dropdown menu with links to `/settings/rca`, `/admin` (admin login), and `/dashboard`. Replace "Ava Morgan" with a configurable display name (settings or env), defaulting to the site owner.

### 7.2 Hero carousel
- **Carousel arrows + dots** → actually cycle through the featured films (client component; the featured list is passed from the server). Optional auto-advance every ~8s, pausing on hover.
- **Movie title** → links to `/films/[id]`.
- **Watch Trailer** → fetch the trailer via TMDB `/movie/{id}/videos` (add to `tmdb-server.ts`, cache 24h; include the YouTube key in the featured-film payload) and open it in a modal with an embedded player, falling back to a YouTube search link if none. Hide the button when no trailer exists.
- **Add to Watchlist** → POST to the existing films API to set/create the film with status `to_watch`; if already in the library, show state accordingly (button becomes "In Watchlist ✓" and can toggle back). Optimistic UI update.
- **Score panel** → clicking the score/histogram area goes to the film's detail page (`/films/[id]`), where the real rating breakdown lives.

### 7.3 Trending Now & Recommended For You rows
- **Poster cards** → in-library films link to `/films/[id]`; TMDB-only films open the add-film dialog prefilled (as specified in Section 6), with "Add to watchlist" as the primary action inside it.
- **Row scrolling** → horizontal scroll with hover chevrons if content overflows.
- **See all →** Trending: a `/discover` page is out of scope unless trivial — at minimum link to the library; prefer a simple `/trending` page reusing the same card grid with the full blended list. Recommended: same pattern (`/recommendations` page showing the full ranked list with reasons). Both pages reuse the home components — small scope.

### 7.4 Popular Reviews
This app's real equivalent of "reviews" is the user's own notes/watch history. Replace the placeholder critic reviews with **the user's own recent film notes** (`films.notes` / watch log entries with notes), showing film title + stars (their rating) + note excerpt. Each card links to `/films/[id]`. The heart/like count is fake social chrome — remove it or repurpose it as a "favorite" toggle only if a favorites concept already exists (it doesn't — so remove). If no notes exist, show a tasteful empty state prompting the user to rate films.

### 7.5 Sidebar
- **Top Critics** → no multi-user backend exists. Repurpose as **"Top Rated"**: the user's highest-rated films (poster thumb, title, score), each linking to `/films/[id]`. Keep the visual layout identical to the mockup rows.
- **Genre chips** → each links to the library filtered by that genre (`/library?genre=Action`); add genre filtering to `library-view.tsx` via query param if not already supported. `View all` → `/library`.
- **Recently Reviewed** → already data-driven; make each row link to `/films/[id]`. `View all activity` → `/dashboard`.

### 7.6 Verification
For EVERY element above, verify interactively in a browser (not just by reading code): click it, confirm navigation/action/state change, and check the browser console for errors. Keep a checklist of all interactive elements and their verified behavior; the page passes when there are zero dead clickables. Also verify keyboard access on the search dropdown and carousel.

---

## 8. Implementation order

1. Read the Next.js docs (caching + route handlers + client/server components + navigation hooks) in `node_modules/next/dist/docs/`.
2. Extend `tmdb-server.ts` with trending/discover/recommendations/similar/videos fetchers + mappers in `tmdb.ts` (with tests, following `tmdb-server.test.ts` style). Respect TMDB rate limits — batch seed fetches with modest concurrency (≤ 4 at a time).
3. Build `taste-profile.ts` + tests against fixture data.
4. Build `candidate-score.ts` + `recommend.ts` + tests (fixtures only, no network).
5. Build `trending.ts` + tests.
6. Build `recs-server.ts` (fetch, cache, orchestrate) and the two API routes.
7. Wire into `src/app/page.tsx`; add the Recommended section UI.
8. Interactivity pass (Section 7): nav + search first, then hero, then rows, then sidebar — verifying each element in the browser as it lands.
9. Screenshot/verify loop for visual regressions against the mockup style; then run `npm run lint` and the full test suite.

## 9. Definition of done

- [ ] `GET /api/recs` returns ranked, reasoned recommendations; `GET /api/recs/trending` returns the blended trending list.
- [ ] Home page shows real trending data and a personalized Recommended row, styled to match the mockup system.
- [ ] All scoring logic is pure and unit-tested (profile, candidate scoring, diversification, trending blend, cold start).
- [ ] Page degrades gracefully with no TMDB key, no network, or an empty library.
- [ ] With zero personalization data, the Recommended slot serves pure TMDB trending (correctly retitled, `mode: "trending"`), and blending phases personalization in as ratings accumulate.
- [ ] Ratings changes invalidate cached recommendations.
- [ ] Zero dead clickables: every button, link, chip, card, arrow, and icon on the home page performs a verified real action (Section 7 checklist complete).
- [ ] Search finds both library and TMDB films; watchlist add works from hero and poster cards; carousel cycles; trailer plays.
- [ ] No fake social chrome remains (placeholder critics/likes replaced or removed).
- [ ] Lint and full test suite pass.
