# Picture House

A film library and rating journal built with Next.js, TypeScript, Tailwind CSS, Drizzle ORM, and PostgreSQL.

## Setup

Requires Node.js 20.9 or newer and a PostgreSQL database. A free hosted database from a provider such as Neon or Supabase works for both local development and Netlify.

Copy `.env.example` to `.env.local`, then replace `DATABASE_URL` with the connection string supplied by your database provider. If the provider gives you both connection types, use its pooled/serverless URL for `DATABASE_URL` and its direct URL for `DATABASE_MIGRATION_URL`.

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The library is at `/library`, analytics are at `/dashboard`, the editable rating scale is at `/rubric`, and the design reference is at `/dev/tokens`.

Set `TMDB_API_KEY` to a TMDB v3 API key to enable search and metadata lookup. The key is read only by server route handlers. All `.env` files are ignored by Git, so database passwords and API keys will not be committed.

## Netlify deployment

This repository deliberately does not use Netlify Database. The previous `netlify/database/migrations` directory caused Netlify to request an account-gated database feature and fail the build with a 403 error.

1. Create a PostgreSQL database with a provider such as Neon or Supabase.
2. In your local `.env.local`, set `DATABASE_URL` and, if provided, `DATABASE_MIGRATION_URL`.
3. Run `npm run db:migrate` once to create the tables.
4. For a new empty library, run `npm run db:seed`. To preserve the existing local library instead, run `npm run db:copy-sqlite` after migrating; this copies `data/movie-ratings.sqlite`, including films, ratings, forms, tags, and watch history.
5. In Netlify, open **Site configuration → Environment variables** and add the provider's pooled/serverless connection string as `DATABASE_URL`. Also add `TMDB_API_KEY` and `ADMIN_PASSCODE` if you use them.
6. Trigger a new deploy. Netlify can keep the build command `npm run build` and the Next.js publish directory `.next`.

Do not add `DATABASE_MIGRATION_URL` to Netlify unless you specifically need it there. Migrations are an intentional one-time setup command and are not run during every site build.

## Phase 2 workflows

- Add films through debounced TMDB search or the manual fallback form.
- Browse Watched as a sortable dense table or poster grid, maintain a drag-ordered To Watch list, and review To Re-Watch titles.
- Share URL-backed title/notes, genre, franchise, year, and score filters.
- Rate all eight attributes with live formula contributions and the secondary Quality score.
- Edit film status and notes, and add, edit, or delete dated watch-log entries.

TMDB metadata requests are proxied server-side, search results are cached for 15 minutes, and the UI includes TMDB's required approved logo and attribution notice.

## Phase 4 workflows

- Review rating distributions, monthly and yearly watch trends, attribute averages, genre and decade breakdowns, franchise report cards, correlations, and RCA tag patterns on `/dashboard`.
- Track current and longest day, week, and month streaks; inspect every logged watch in the year calendar; and optionally set a weekly pace goal.
- Select genre, decade, franchise, and RCA analytics to open the corresponding URL-filtered library view.
- Edit the 0–10 meanings and example films on `/rubric`; rating screens link directly to this reference.
- Visually review the bar, histogram, radar, sparkline, and heatmap primitives on `/dev/components`.

## Commands

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm test` — run the unit tests
- `npm run lint` / `npm run typecheck` — static verification
- `npm run db:generate` — generate a migration after a schema change
- `npm run db:migrate` — apply migrations to the configured PostgreSQL database
- `npm run db:seed` — seed the default form, rating scale, and RCA tags
- `npm run db:copy-sqlite` — copy the existing local SQLite data into an empty PostgreSQL database
- `npm run import -- --dry-run file.xlsx` — preview and verify a workbook import

See [IMPORTING.md](IMPORTING.md) for the import contract and verification behavior.

## Data caveat

The source workbook and its full `Rating Scale` tab were not included in this repository. The seed contains the supplied anchor language for scores 10, 5, and 0 plus editable interim descriptions for the remaining levels. Replace the rubric through seed data when the source text becomes available. The importer is complete, but its real-data exit check can only be run once the `.xlsx` is supplied.

## Dependency audit

The production audit currently reports moderate upstream advisories in Next.js's bundled PostCSS and ExcelJS's UUID dependency, with no high or critical findings. npm's automatic remediation proposes incompatible downgrades, so these are documented for upstream updates rather than force-applied. The UUID advisory concerns a buffer-writing API that this trusted local-file importer does not call.
