# Recommendation core

This directory contains the deterministic, side-effect-free recommendation
algorithms. Modules here accept plain data and return plain ranked results;
database access, TMDB requests, and Next.js caching belong in
`src/lib/recs-server.ts`.

- `taste-profile.ts` builds the single-user taste profile.
- `candidate-score.ts` scores one TMDB candidate against that profile.
- `recommend.ts` filters, blends, and diversifies candidates.
- `trending.ts` blends TMDB trending order with library signals.

The server edge uses the repository's Next.js 16.2 "previous" caching model:
`fetch(..., { next: { revalidate, tags } })` for TMDB responses, React `cache`
for render-pass deduplication, and tag invalidation after rating mutations.
