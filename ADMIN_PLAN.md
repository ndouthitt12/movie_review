# Admin Area — Executable Specification

**Audience: the AI model executing this change.** This document specifies WHAT to build and how to verify it. File paths, exported symbols, data shapes, and acceptance criteria are normative. Micro-implementation (variable names, easing curves, internal helpers, exact copy) is yours. Anything genuinely undecided is marked **OPEN DECISION** — surface these to the user rather than silently choosing; if you must proceed, pick the listed default and say so in your report.

**Prime directive:** this migration generalizes a live rating system holding ~365 real ratings. Any step whose verification fails must be rolled back, not patched forward. Take a timestamped copy of the SQLite file in `data/` before Step 2 and state its path in your report.

Read `AGENTS.md` first: this project's Next.js version has breaking changes — consult `node_modules/next/dist/docs/` before writing route handlers or pages.

---

## 0. Current codebase facts (verified 2026-07-13 — trust these, but re-verify exports before editing)

- Stack: Next.js 16 App Router, TypeScript, Tailwind 4, Drizzle + better-sqlite3, Zod 4, Vitest, exceljs.
- Commands: `npm run test` (vitest), `npm run typecheck`, `npm run lint`, `npm run db:generate`, `npm run db:migrate` (tsx scripts/migrate.ts), `npm run db:seed`, `npm run dev`.
- Schema: [src/db/schema.ts](src/db/schema.ts) — tables `franchises`, `films`, `ratings` (fixed columns `story|direction|writing|acting|music|impact|rewatchability|genre_fit|quality`, unique on `film_id`), `watch_log`, `rca_tags` (bound to `attribute` enum incl. `overall`), `film_rca_tags`, `settings` (json `weights`, json `rubric`).
- Scoring: [src/lib/scoring.ts](src/lib/scoring.ts) — `computeOverall(scores: AttributeScores, weights: RatingWeights)`, `computeSecondary(quality, rewatchability, genreFit)`, `rankFilms`. Weights shape: `Record<ScoreAttribute, number> & { rewatchabilityOffset: number; divisor: number }`. Pinned tests in `src/lib/scoring.test.ts` (Jurassic Park → 9.988023952 etc.) MUST keep passing.
- Rating UI: [src/components/film/rating-editor.tsx](src/components/film/rating-editor.tsx) on [src/app/films/[id]/page.tsx](src/app/films/[id]/page.tsx); save route [src/app/api/films/[id]/rating/route.ts](src/app/api/films/[id]/rating/route.ts) validated by `ratingSchema` in [src/lib/validation.ts](src/lib/validation.ts).
- RCA: manager at `src/app/settings/rca/page.tsx` + `src/components/rca/rca-manager.tsx`; multiselect `src/components/rca/rca-multiselect.tsx`; API `src/app/api/rca-tags/*`; helpers `src/lib/rca.ts`.
- Rubric: `getRubric()` in [src/lib/catalog.ts](src/lib/catalog.ts), page `src/app/rubric/page.tsx`, editor `src/components/rubric-editor.tsx`, route `src/app/api/settings/rubric/route.ts`.
- Dashboard stats: [src/lib/stats.ts](src/lib/stats.ts) keyed on `ScoreAttribute`; data assembled by `getDashboardData()` in `src/lib/catalog.ts`.

---

## 1. Target model

### 1.1 New Drizzle tables (add to `src/db/schema.ts`)

```ts
// enums (const arrays, same pattern as filmStatuses)
questionTypes = ["slider","short_text","paragraph","dropdown","multi_select","multiple_choice","integer"]
conditionOperators = ["equals","not_equals","in","answered","gte","lte"]
conditionEffects = ["show","disable"]          // show = hidden until met; disable = grayed out until met
conditionLogics = ["all","any"]
blankPolicies = ["treat_as_zero","exclude_and_renormalize"]
multiSelectScorings = ["sum","avg"]
divisorModes = ["auto","manual"]
```

**`form_versions`**: `id` PK, `label` text notNull, `status` text enum `draft|published|archived` notNull, `divisor_mode` enum notNull default `manual`, `manual_divisor` real nullable, `created_at`, `published_at` nullable. Partial unique index enforcing at most one `published` and at most one `draft` row.

**`form_sections`**: `id`, `form_version_id` FK cascade, `title` text, `sort_order` int.

**`questions`**: `id`, `form_version_id` FK cascade, `key` text notNull (stable slug across versions; unique per version), `label` text notNull, `help_text` text default "", `type` enum notNull, `section_id` FK nullable set-null, `sort_order` int notNull, `required` bool notNull default false, `scored` bool notNull default false, `weight` real nullable, `min` real nullable, `max` real nullable, `offset` real notNull default 0, `blank_policy` enum notNull default `exclude_and_renormalize`, `multi_select_scoring` enum nullable, `allow_na` bool notNull default false (slider/integer N/A affordance), `condition_logic` enum notNull default `all`, `rca_enabled` bool notNull default false, `archived_at` text nullable.
Invariants (enforce in Zod + publish validation, not necessarily CHECKs): `scored=true` ⇒ `weight` notNull; `type in (short_text,paragraph)` ⇒ `scored=false`; slider defaults min 0 / max 100.

**`question_options`**: `id`, `question_id` FK cascade, `label` text notNull, `value_score` real nullable, `is_null` bool notNull default false (null response: selectable, contributes NO data — excluded + renormalized; satisfies `required`), `sort_order` int, `archived_at` nullable. Invariant: parent scored ⇒ every non-archived, non-null option has `value_score`.

**`question_conditions`**: `id`, `question_id` FK cascade (target), `source_question_id` FK cascade, `operator` enum, `value` json (`number | number[] | null` — option ids or numeric threshold), `effect` enum. Invariant: source `sort_order` < target `sort_order` (validate on write and on reorder).

**`answers`**: `id`, `film_id` FK cascade, `question_id` FK cascade, `value_number` real nullable, `value_text` text nullable, `value_option_ids` json nullable (`number[]`), `is_na` bool notNull default false. Unique on (`film_id`,`question_id`).
**OPEN DECISION:** no `rating_session_id` — one rating per film, matching today's unique-per-film `ratings`. If the user wants re-rating history later, that's a separate feature; do not add the column speculatively.

**`scale_levels`**: `level` int PK (0–10), `title` text default "", `meaning` text default "", `example_films` text default "". Replaces `settings.rubric`.

**`ratings` (modified):** drop the eight attribute columns + `quality`; keep `id`, `film_id` (unique), add `form_version_id` FK notNull, keep `overall`, `overall_secondary`, `rated_at`. SQLite can't drop columns cleanly in old versions — use Drizzle's table-recreate migration or a new table + rename; either is fine if data survives (Step 2 verification proves it).

**`rca_tags` (modified):** replace `attribute` enum column with `question_key` text notNull (values seeded from the old enum; `overall` stays the literal key `"overall"`). Update unique index to (`label`,`question_key`).

### 1.2 Scoring engine — `src/lib/scoring.ts` (extend, don't delete existing exports until Step 5 removes their last caller)

New exports (exact names):

```ts
export type QuestionConfig = {
  id: number; key: string; type: QuestionType; required: boolean;
  scored: boolean; weight: number | null; min: number | null; max: number | null;
  offset: number; blankPolicy: BlankPolicy; multiSelectScoring: "sum"|"avg"|null;
  allowNa: boolean; conditionLogic: "all"|"any";
  conditions: Array<{ sourceQuestionId: number; operator: ConditionOperator;
                      value: number | number[] | null; effect: "show"|"disable" }>;
  options: Array<{ id: number; valueScore: number | null; isNull: boolean }>;
};
export type FormConfig = { divisorMode: "auto"|"manual"; manualDivisor: number | null;
                           questions: QuestionConfig[] };
export type AnswerValue = { number?: number | null; text?: string | null;
                            optionIds?: number[] | null; isNa?: boolean };
export type AnswerMap = Record<number /* questionId */, AnswerValue | undefined>;

export function evaluateConditions(q: QuestionConfig, answers: AnswerMap):
  { visible: boolean; enabled: boolean };            // transitive: suppressed source ⇒ suppressed target
export function questionContribution(q: QuestionConfig, answers: AnswerMap):
  { points: number; maxPoints: number; counted: boolean; reason?: "na"|"null_option"|"blank"|"suppressed"|"unscored" };
export function computeOverallFromForm(form: FormConfig, answers: AnswerMap):
  { overall: number; terms: Array<{ questionId: number } & ReturnType<typeof questionContribution>> };
```

Semantics (normative):
- `points` = `(answerNumber + offset) * weight` for slider/integer; for dropdown/multiple_choice, answerNumber = selected option's `valueScore`; for multi_select, `sum` or `avg` of selected non-null options' scores.
- `maxPoints` = the question's maximum possible points (for auto-divisor and renormalization). For negative-capable configs use max over option scores / `(max + offset) * weight`.
- `counted=false` cases: unscored; suppressed by conditions; `is_na` answer; null option selected; blank with `exclude_and_renormalize`. Blank with `treat_as_zero` ⇒ counted, points 0.
- Divisor: `manual` ⇒ `manualDivisor`; `auto` ⇒ Σ `maxPoints` of counted questions (recomputed per rating — this IS the renormalization). Manual mode + non-counted question ⇒ subtract that question's `maxPoints` from the divisor.
- `overall = max(0, Σ counted points / divisor)`; throw `RangeError` if divisor ≤ 0.
- Multi-select: a null option cannot be combined with scored options (reject in validation, not here).

**Equivalence requirement:** `computeOverallFromForm(seededV1Config, answersFor(film))` must equal the legacy `computeOverall` to within 1e-9 for all pinned test cases and (in Step 2) for every rated film to 3 decimals.

**OPEN DECISION — secondary score:** `computeSecondary` (quality×5 + rewatchability×4 + genreFit)/100 stays hardcoded, reading answers by keys `quality`, `rewatchability`, `genre_fit`. Generalizing it to a second configurable formula is out of scope unless the user asks. Default: keep hardcoded.

---

## 2. Steps

Each step ends with **Run** (commands that must pass) and **Accept** (criteria). Do not start a step until the previous step's Run is green. Steps 4 and 5 may be built in parallel only if by separate executors; a single executor does them in order.

### Step 1 — Schema + scoring engine (no UI, no data movement)

Modify: `src/db/schema.ts` (add §1.1 tables; do NOT yet modify `ratings`/`rca_tags` — that's Step 2), `src/lib/scoring.ts` (§1.2), new `src/lib/form-config.ts` with `getPublishedForm(): Promise<FormConfig|null>` and `getDraftForm()` (Drizzle queries assembling FormConfig), `src/lib/validation.ts` (Zod schemas: `questionSchema`, `questionOptionSchema`, `conditionSchema`, `answerSchema`, enforcing §1.1 invariants).
Create: `drizzle` migration via `npm run db:generate`; `src/lib/scoring-form.test.ts` covering: v1-equivalence fixture (build the v1 FormConfig in-test, assert equality with legacy `computeOverall` on the existing pinned rows), null option, N/A, blank×both policies, suppressed question renormalization, transitive suppression, multi_select sum vs avg, auto vs manual divisor, divisor ≤ 0 throw.

**Run:** `npm run db:migrate && npm run test && npm run typecheck && npm run lint`
**Accept:** all green; existing `scoring.test.ts` untouched and passing; new tables exist (verify with a quick `sqlite3`/script query listing table names).

### Step 2 — Seed form v1 + backfill (RUNS ALONE; backup first)

Create `scripts/migrate-to-forms.ts` (add npm script `db:forms-migrate`). In ONE better-sqlite3 transaction:
1. Insert form_version v1 (`status='published'`, `divisor_mode='manual'`, `manual_divisor=334`, label `"v1 — spreadsheet-era form"`), section "Attributes", eight slider questions with keys/weights exactly: story 5, direction 5, writing 5, acting 5, music 2, impact 4, rewatchability 10 with `offset=-50`, genre_fit 3; all `required`, `scored`, `rca_enabled`, min 0 max 100. Section "Quality (secondary)": `quality` slider, unscored, optional, `rca_enabled=false`.
2. Backfill `answers` from every `ratings` row (eight columns + quality → `value_number`).
3. Recreate `ratings` per §1.1 with `form_version_id=1`; recreate `rca_tags` with `question_key` (map old enum values 1:1).
4. Move `settings.rubric` json into `scale_levels` rows.
5. **Verification gate inside the transaction:** for every film with a rating, recompute via `computeOverallFromForm` and compare to stored `overall` — `Math.abs(diff) < 5e-4` for ALL rows or throw (which rolls back). Also assert: answers row count = old ratings count × 9 (8 attributes + quality where present — count precisely), rca_tags count unchanged, scale_levels has 11 rows.

Update `src/lib/importer.ts` + `scripts/import.ts` to write `answers` + new `ratings` shape (keep `verifyImport` semantics); update `scripts/seed.ts` to seed v1 form + scale_levels on a fresh DB instead of `settings.rubric`/`weights`.

**Run:** backup `data/*.sqlite*` → then `npm run db:migrate && npm run db:forms-migrate && npm run test && npm run typecheck`
**Accept:** migration script prints a verification report (films checked, max diff) and exits 0; re-running it is a safe no-op (guard: if `form_versions` non-empty, exit with message); `npm run test` green including importer tests updated for the new write path.

### Step 3 — Runtime form on the film page

Create: `src/components/form/question-renderer.tsx` (exported `QuestionRenderer` — switch over all 7 types; used by BOTH film page and admin preview), plus per-type inputs in `src/components/form/` (`short-text.tsx`, `paragraph.tsx`, `dropdown.tsx`, `multiple-choice.tsx`, `integer-input.tsx`; slider extracted from the current rating editor; multi-select generalizes `src/components/rca/rca-multiselect.tsx` internals — refactor, don't fork).
Modify: `src/components/film/rating-editor.tsx` to render from `getPublishedForm()` (sections in order; required markers; RCA multiselect where `rca_enabled`); live Overall + per-question contribution readout driven by `computeOverallFromForm(...).terms`; conditional behavior — `show`: absent until met; `disable`: rendered non-interactive at reduced opacity with tooltip "Enabled when: …"; when a dependent answer becomes suppressed, retain it in state, exclude from scoring, badge it "not counted" (clearing is an explicit user action). N/A affordance where `allow_na`. Validation: required applies only to visible+enabled questions; null option satisfies required; multi-select null option exclusive.
Modify: `src/app/api/films/[id]/rating/route.ts` + `validation.ts` `ratingSchema` → accept `{ formVersionId: number; answers: Array<{questionId, valueNumber?, valueText?, valueOptionIds?, isNa?}> }`, recompute `overall`/`overallSecondary` server-side (never trust client math), upsert `answers` + `ratings` in one transaction.
Historical display: film page renders a rating using ITS `form_version_id`'s questions with badge "rated under v1" when that version isn't the published one.

**Run:** `npm run test && npm run typecheck && npm run lint && npm run build`, then `npm run dev` and manually: open a rated film — identical scores/labels as pre-migration; edit one slider, save, reload, value + overall persist and match `scoring-form.test.ts` math.
**Accept:** for the seeded v1 config the rating flow is behavior-identical to pre-migration; route tests (extend `src/lib/phase2-routes.test.ts` pattern) cover save/upsert/validation-reject.

### Step 4 — Admin area: builder, scoring, scale, RCA

Route group `src/app/admin/` with shared layout + sidebar (Form Builder · Scoring · Rating Scale · RCA Tags · Versions).
**OPEN DECISION — access control:** none (localhost-only app) vs. passphrase env var checked in `src/app/admin/layout.tsx` middleware. Default: none, but leave a single choke point (the layout) where a check can be added.

- **4a Draft/versions API.** `src/app/api/admin/form/route.ts` (+ nested routes as needed under `src/app/api/admin/`): get draft (creating one as a copy of published if absent — deep-copy sections/questions/options/conditions with new ids, same `key`s), mutate questions/options/conditions/sections (Zod-validated; condition source-before-target enforced), reorder, archive. Publish endpoint: validation (every scored question has weight; option-typed scored questions have ≥1 non-null scored option; conditions acyclic and forward-referencing; divisor sane — manual > 0 or auto with ≥1 scored question) then atomically archive current published + publish draft.
- **4b Form Builder page** `src/app/admin/form/page.tsx`: two-pane — left: draggable question cards grouped by section (reuse the To-Watch drag-reorder mechanics from `library-view.tsx`) showing type/required/scored+weight/condition/RCA badges; right: **live preview** embedding `QuestionRenderer` against the draft config with scratch answers (conditions demonstrable live). Question editor panel per §1.1 fields; option editor rows = label + score field (when scored) + "null response" toggle that swaps the score field for an "N/A — not counted" badge. Reorder that would break a condition: blocked with an explanatory message.
- **4c Scoring page** `src/app/admin/scoring/page.tsx`: table of scored questions (weight, offset, min/max, maxPoints, live % share of Overall); divisor mode switch with live auto-divisor readout; per-question blank policy; **sandbox** (enter hypothetical answers → itemized terms via `computeOverallFromForm`); **recompute action** `src/app/api/admin/recompute/route.ts` — dry-run returns per-film before/after diff (UI shows count changed, max delta, top 10 movers), commit applies under the published version.
- **4d Rating Scale page** `src/app/admin/scale/page.tsx`: editable 11-row table backed by `scale_levels` (new `src/app/api/admin/scale/route.ts`); public `src/app/rubric/page.tsx` becomes read-only rendering `scale_levels`; delete `rubric-editor.tsx` + `api/settings/rubric` once nothing references them.
- **4e RCA relocation**: move manager UI to `src/app/admin/rca/page.tsx`; `src/app/settings/rca/page.tsx` redirects; tag create/edit binds to `question_key` populated from the draft's questions + `"overall"`. Existing merge/usage-count behavior unchanged (`src/lib/rca.ts`).

**Run:** `npm run test && npm run typecheck && npm run lint && npm run build`; manual: create draft → add a scored dropdown ("Would you watch this film again?" Absolutely=100/Maybe someday=50/Never again=0/N-A null) with weight, add a paragraph question with `show` condition on "Never again", reorder, publish; rate a film with it and verify the itemized contribution.
**Accept:** §4 acceptance checklist rows below all pass; publish validation rejects each invalid state listed in 4a with a specific message.

### Step 5 — Integration, stats, cleanup

- `src/lib/stats.ts` + `getDashboardData()` in `catalog.ts`: attribute averages/correlations/labels derive from the published form's scored questions (`key` + `label`) instead of the hardcoded `ScoreAttribute` — custom scored questions appear automatically; text questions excluded. RCA analytics group by `question_key`.
- CSV/JSON export: JSON includes form versions/questions/options/conditions/answers/scale_levels; CSV maps v1 keys to original sheet columns and appends custom-question columns.
- Remove now-dead code: legacy `AttributeScores`-based paths whose last caller disappeared (verify with `npm run typecheck` + grep before deleting `computeOverall` — the importer's `verifyImport` may still legitimately use it; keeping it for import verification is acceptable).
- Condition fuzz test: generate random forms + answer sets, assert `evaluateConditions` never loops and suppressed questions never contribute.

**Run:** full suite — `npm run test && npm run typecheck && npm run lint && npm run build`; manual e2e: TMDB-add → rate with custom question + RCA → dashboard shows the custom attribute → export contains it → archive the question → history intact.
**Accept:** checklist below fully green.

---

## 3. Acceptance checklist (final gate — verify each literally)

- [ ] All pre-migration ratings show identical overall scores (3 decimals) and render their original v1 questions.
- [ ] Rename an attribute + change weight in a draft, publish → new ratings use it; old unchanged; recompute dry-run shows correct diff, commit applies it.
- [ ] "Would you watch this film again?" scored dropdown works end-to-end; contribution readout itemizes it.
- [ ] Edit an option's score (50→60), publish → new ratings use new mapping; old unchanged until recompute.
- [ ] Null option on a required question: save succeeds, overall renormalizes, readout shows "N/A — not counted".
- [ ] `show` condition (paragraph appears on "Never again") and `disable` condition (question grayed with explanatory tooltip) both behave live, transitively.
- [ ] Reorder that breaks a condition is blocked with explanation.
- [ ] Optional scored question skipped with renormalize policy → overall not penalized; with treat_as_zero → counted as 0.
- [ ] Scored↔unscored toggle round-trips in a draft; answers persist; effect only after publish.
- [ ] Scale editable at /admin/scale; /rubric reflects it read-only.
- [ ] RCA tags on a custom question: create/merge/archive with usage counts.
- [ ] Dashboard picks up custom scored questions; text questions absent from stats.
- [ ] `npm run test && npm run typecheck && npm run lint && npm run build` all pass; no step required editing code to configure the form.

## 4. OPEN DECISIONS (summary — ask the user)

1. **Secondary score**: keep hardcoded (default) vs. make it a second configurable formula.
2. **Admin access control**: none/localhost (default) vs. passphrase.
3. **Re-rating history** (`rating_session_id`): out of scope (default) vs. include now.
