# Copy-paste prompt for ChatGPT 5.6 Sol

---

Implement the plan in `RECOMMENDATIONS-PLAN.md` at the repository root, in full.

**How to work through it:**

1. Start by reading `RECOMMENDATIONS-PLAN.md` end to end, plus `AGENTS.md`. Section 0's ground rules apply to everything you do — especially: this repo uses a Next.js version with breaking changes, so read the relevant guides in `node_modules/next/dist/docs/` before writing any code, and this is a single-user app, so no multi-user infrastructure.

2. Implement one phase at a time, in this order, and get each phase fully green (lint + full test suite passing) before starting the next:
   - **Phase 1 — Setup:** Sections 0–2. Read the docs, review the data model (`src/db/schema.ts`, `src/lib/catalog.ts`, `src/lib/scoring.ts` for conventions), scaffold `src/lib/recs/`.
   - **Phase 2 — TMDB fetchers:** extend `src/lib/tmdb-server.ts` and `src/lib/tmdb.ts` with trending, discover, recommendations, similar, and videos endpoints + mappers + tests (follow the existing `tmdb-server.test.ts` style).
   - **Phase 3 — Taste profile:** Section 3. Pure functions + fixture-based tests.
   - **Phase 4 — Recommendation pipeline:** Section 4, including the cold-start TMDB-trending fallback (4.5), `recs-server.ts`, and the two API routes. If this runs long, split it: pure scoring + tests first, then server orchestration + routes.
   - **Phase 5 — Trending blend:** Section 5, pure core + tests.
   - **Phase 6 — Home page integration:** Section 6. Wire real data into the page, add the Recommended section, match the visual system in `GUI-REDESIGN-INSTRUCTIONS.md`.
   - **Phase 7 — Interactivity:** Section 7. Make every element on the home page functional; verify each one by clicking it in a real browser and checking the console. Zero dead clickables.

3. After each phase, report: what was built, test results, and any deviations from the plan with reasons. Do not deviate silently.

4. Verify visually as specified in the plan: run the dev server, screenshot the home page, compare against the established style, iterate. Save progress screenshots to `docs/mockup/progress/`.

5. Finish by checking off every item in the plan's Definition of Done (Section 9) explicitly, one by one, stating how each was verified.

**Guardrails:**
- Never let the home page crash because TMDB is unavailable — degrade as the plan specifies.
- Keep all scoring logic pure and unit-tested; no fetching or DB calls inside scoring functions.
- Seed the database (`scripts/seed.ts`) if it's empty so you can see real output.
- If you hit a genuine ambiguity the plan doesn't resolve, make the smallest reasonable choice, note it in your phase report, and continue — don't stall.
- Commit after each completed phase with a descriptive message so progress is recoverable.

If you run out of context mid-implementation, stop at a phase boundary and state clearly which phases are complete and verified — the plan file plus your commits are the handoff for the next session.
