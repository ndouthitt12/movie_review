# Picture House

A local-first film library and rating journal built with Next.js, TypeScript, Tailwind CSS, Drizzle ORM, and SQLite.

## Setup

Requires Node.js 20.9 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The Phase 1 design reference is at `http://localhost:3000/dev/tokens`.

`TMDB_API_KEY` is reserved for the Phase 2 server-side proxy. `DATABASE_URL` defaults to `data/movie-ratings.sqlite`; the database and all `.env` files are ignored by Git.

## Commands

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm test` — run the unit tests
- `npm run lint` / `npm run typecheck` — static verification
- `npm run db:generate` — generate a migration after a schema change
- `npm run db:migrate` — apply migrations to the configured database
- `npm run db:seed` — upsert default weights and rubric
- `npm run import -- --dry-run file.xlsx` — preview and verify a workbook import

See [IMPORTING.md](IMPORTING.md) for the import contract and verification behavior.

## Data caveat

The source workbook and its full `Rating Scale` tab were not included in this repository. The seed contains the supplied anchor language for scores 10, 5, and 0 plus editable interim descriptions for the remaining levels. Replace the rubric through seed data when the source text becomes available. The importer is complete, but its real-data exit check can only be run once the `.xlsx` is supplied.

## Dependency audit

The production audit currently reports moderate upstream advisories in Next.js’s bundled PostCSS and ExcelJS’s UUID dependency, with no high or critical findings. npm’s automatic remediation proposes incompatible downgrades, so these are documented for upstream updates rather than force-applied. The UUID advisory concerns a buffer-writing API that this trusted local-file importer does not call.
