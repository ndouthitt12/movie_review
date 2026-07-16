# Performance Fix Plan: Slow Page-to-Page Navigation

## Context for the implementer

**Symptom:** Client-side navigation (clicking a nav tab, e.g. Home → Library) freezes for
several seconds with zero visual feedback, then the new page appears all at once.

**Root causes (confirmed by code inspection):**

1. Every page exports `export const dynamic = "force-dynamic"` and is an async Server
   Component that awaits all its data before rendering. There are **no `loading.tsx` files
   anywhere** in `src/app/`, so during a client navigation the old page stays frozen until
   the destination's server render fully completes.
2. `src/db/index.ts` creates the postgres.js client with `max: 1`. The database is a
   remote Supabase instance (`aws-1-us-east-2.pooler.supabase.com`), so every query pays a
   network round trip — and with a single connection, the `Promise.all([...])` query
   batches on each page actually execute **serially**.
3. `getLibraryFilms()` in `src/lib/catalog.ts` is one giant query left-joining
   `films × ratings × filmRcaTags × rcaTags × answers × questions`. The joins multiply:
   a film with 5 tags and 8 answers returns 40 rows. Across the whole library this is a
   large cartesian blow-up transferred over the wire on **every** page that calls it
   (home, library, dashboard, and others).

**Important repo rule (from AGENTS.md):** this project uses a Next.js version
(`next@16.2.10`) with breaking changes vs. public docs. Before writing code, read the
relevant guides in `node_modules/next/dist/docs/` — especially:

- `01-app/03-api-reference/03-file-conventions/loading.md`
- `01-app/02-guides/instant-navigation.md` (relevant only to Phase 4)

Do the phases **in order**. Phases 1–3 are required; Phase 4 is optional/stretch.
Run `npm run lint`, `npm run typecheck`, and `npm run test` after each phase.

---

## Phase 1 — Add loading states (fixes the "nothing happens" feel)

### 1.1 ADD `src/app/loading.tsx` (new file)

A root-level loading boundary covers client navigations to every top-level route
(`/`, `/library`, `/trending`, `/recommendations`, `/dashboard`, `/rubric`,
`/films/[id]`, `/settings/rca`). Render a lightweight skeleton that reuses the existing
shell so the header/nav don't flash:

```tsx
export default function Loading() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-white/10" />
          <div className="h-4 w-72 rounded bg-white/5" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg bg-white/5" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
```

Adjust class names to match existing tokens in `src/app/globals.css` /
`src/components/page-shell.module.css` if the placeholder colors clash with the theme
(the app uses `paper-*` tokens). Do **not** import `PageShell` here — it reads
`process.env` and includes Suspense-wrapped children; keep the loading file dependency-free
and light.

### 1.2 ADD `src/app/admin/loading.tsx` (new file)

Admin routes live under their own layout (`src/app/admin/layout.tsx`); give them the same
skeleton (a copy of 1.1 is fine) so navigations between admin tabs also get instant
feedback.

### 1.3 Verify

`npm run dev`, click between Home / Library / Trending / Recommendations / Dashboard.
The skeleton must appear **immediately** on click; content streams in after.

---

## Phase 2 — Fix the database connection pool

### 2.1 CHANGE `src/db/index.ts`

Current (lines 7–12):

```ts
const postgresClient = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20,
});
```

Change `max: 1` → `max: 10`. Keep `prepare: false` (required: the connection string
targets Supabase's transaction-mode pooler on port 6543, which doesn't support prepared
statements). Keep the other options as-is.

This alone makes each page's `Promise.all([...])` query batch actually run in parallel
instead of queuing on one connection.

---

## Phase 3 — Split the `getLibraryFilms` mega-join

### 3.1 CHANGE `src/lib/catalog.ts`, function `getLibraryFilms` (lines 19–134)

Replace the single 6-table left-join with **three parallel queries**, merged in JS.
The function's return type and shape must remain **identical** (it's consumed via the
exported `LibraryFilm` type by home, library, dashboard, and components).

Structure:

```ts
export async function getLibraryFilms() {
  const subFranchises = alias(franchises, "sub_franchises");
  const [filmRows, tagRows, answerRows] = await Promise.all([
    // Query 1: one row per film (+ rating overall/formVersionId, franchise names)
    db
      .select({
        // all existing film columns (id, tmdbId, title, releaseYear, status,
        // watchOrder, lastWatchDate, genrePrimary, genreSecondary, franchiseId,
        // subFranchiseId, notes, posterPath, backdropPath, runtime, overview,
        // tmdbGenres, director) plus:
        franchise: franchises.name,
        subFranchise: subFranchises.name,
        formVersionId: ratings.formVersionId,
        overall: ratings.overall,
      })
      .from(films)
      .leftJoin(ratings, eq(ratings.filmId, films.id))
      .leftJoin(franchises, eq(franchises.id, films.franchiseId))
      .leftJoin(subFranchises, eq(subFranchises.id, films.subFranchiseId))
      .orderBy(asc(films.watchOrder), asc(films.title)),

    // Query 2: film RCA tags
    db
      .select({
        filmId: filmRcaTags.filmId,
        id: rcaTags.id,
        label: rcaTags.label,
        attribute: rcaTags.questionKey,
        polarity: rcaTags.polarity,
        color: rcaTags.color,
      })
      .from(filmRcaTags)
      .innerJoin(rcaTags, eq(rcaTags.id, filmRcaTags.rcaTagId))
      .orderBy(asc(rcaTags.label)),

    // Query 3: per-film answer scores
    db
      .select({
        filmId: answers.filmId,
        key: questions.key,
        value: answers.valueNumber,
      })
      .from(answers)
      .innerJoin(questions, eq(questions.id, answers.questionId)),
  ]);

  // Build lookup maps keyed by filmId, then map filmRows to the same output
  // shape as today: { ...film, story, direction, writing, acting, music,
  // impact, rewatchability, genreFit, rcaTags }
}
```

Merge rules (must match current behavior exactly):

- Score keys map: `story`, `direction`, `writing`, `acting`, `music`, `impact`,
  `rewatchability`, and `genreFit` comes from the question key `"genre_fit"`.
  Missing scores are `null`. Skip answer rows where `value` is `null`.
- `rcaTags` is an array of `{ id, label, attribute, polarity, color }`, deduplicated by
  tag id, sorted by label (query 2's `orderBy` handles the sort; preserve insertion order
  when building the per-film array).
- If a film has multiple `ratings` rows, current code effectively keeps the last one
  encountered per film id — keeping the first is acceptable, but films are expected to
  have at most one rating.
- Preserve the film ordering: `watchOrder` asc, then `title` asc.

### 3.2 Verify

- `npm run test` (there are vitest tests; check whether any cover `catalog.ts` and update
  only if the change legitimately breaks a test's mock shape, not its expectations).
- `npm run typecheck` must pass with **no changes to any consumer** of `LibraryFilm`.
- Load `/library` in the browser and confirm films show correct scores and RCA tag chips.

---

## Phase 4 (OPTIONAL — only if Phases 1–3 land cleanly)

Migrate to this Next version's Cache Components model for truly instant navigation:

1. Set `cacheComponents: true` in `next.config.ts`.
2. **Remove every `export const dynamic = "force-dynamic"`** (14 occurrences across
   `src/app/**/page.tsx`) — the `dynamic` segment config is *removed* when Cache
   Components is enabled and will error.
3. Restructure pages so uncached data fetches sit inside `<Suspense>` boundaries, and add
   `export const unstable_instant = { prefetch: 'static' }` to the main pages to get
   build-time validation. Follow
   `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md` exactly.
4. Cache stable reads (e.g. `getCatalogOptions`) with `'use cache'` + `cacheTag`, and call
   `updateTag`/`revalidateTag` from the mutation route handlers under `src/app/api/`.

This phase touches many files; treat it as its own PR. Do **not** attempt it partially —
a half-migration (cacheComponents on, force-dynamic still present) breaks the build.

---

## Out of scope / do not touch

- Do not change the rating/scoring logic (`src/lib/scoring.ts`).
- Do not modify the DB schema or add migrations.
- Do not swap the postgres driver or the Supabase pooler port.
- `.env.local` stays untouched.

## Acceptance criteria

1. Clicking any bottom-nav tab shows visible feedback (skeleton) in < 100 ms.
2. Full page content on Home and Library appears noticeably faster (pool parallelism +
   smaller result sets).
3. `npm run lint`, `npm run typecheck`, `npm run test` all pass.
4. No visual or data regressions on `/`, `/library`, `/dashboard`, `/films/[id]`.
