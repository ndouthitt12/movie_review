# Form Builder Redesign Plan

Restructure the admin Form Builder (`src/app/admin/form/page.tsx` → `src/components/admin/form-builder.tsx`) from a single-column accordion into a master–detail editor with autosave, a tabbed question editor, an inspector-style preview, and polished reorder/feedback interactions.

**Scope:** Phases 1–5 are frontend only. The existing API (`/api/admin/form` actions: `update_form`, `add_section`, `add_question`, `update_question`, `reorder`, `add_condition`, `delete_condition`, `add_options`, `save_option`, `archive_option`, `archive_question`; plus `/api/admin/form/publish`) already supports them, except possibly a `reorder` payload extension for cross-section drag (see Phase 5). Phases 6–7 (section management, Title/Divider elements) require backend changes and are called out explicitly.

**Guiding principles**

- One save model: autosave everything; "Publish draft" is the only deliberate action.
- The selected question is the unit of work: the outline selects it, the editor edits it, the preview shows it.
- Scoring is first-class, not buried: plain-English labels and visible weight shares.
- Reuse existing design tokens/components (`panel`, `eyebrow`, `select-field`, `Button`, `QuietButton`, `Input`, `Badge`).

---

## Phase 1 — Master–detail layout

**Goal:** Replace the accordion column with a two-pane layout: outline (left) + editor (right).

1. **Split `form-builder.tsx` into a directory** — it's ~1,000 lines and about to grow:
   ```
   src/components/admin/form-builder/
     index.tsx            // FormBuilder shell: state, layout, data flow
     outline.tsx          // section/question outline (left pane)
     question-editor.tsx  // tabbed editor (right pane)
     preview.tsx          // inspector preview (Phase 4)
     use-form-draft.ts    // draft state + autosave hook (Phase 2)
   ```
2. **Outline pane (left, ~20rem):**
   - Sections as group headers; each question is a compact row: drag handle placeholder, label (truncated), type badge, and small dot-indicators for conditional/RCA/scored instead of the current badge row.
   - Clicking a row selects it (`selectedId` state, replaces `expandedId`).
   - "Unsectioned" group only when needed (same logic as today).
   - Keep the AddQuestion form, but collapse it to a single "+ Add question" button per section footer that expands an inline row (title + type; section is implied). Auto-select the new question after creation (reuse the existing `existingIds` diff trick).
3. **Editor pane (right, flexible width):** renders `QuestionEditor` for the selected question, or an empty state ("Select a question to edit") when nothing is selected.
4. **Responsive:** below `xl`, fall back to a stacked mode where selecting a question in the outline shows the editor (outline collapses to a drawer or the editor renders below the selected row). Simplest acceptable v1: outline on top, editor below, with scroll-into-view on select.
5. Header stays: draft version eyebrow, "Publish draft" button.

**Done when:** clicking questions in the outline swaps the editor with no layout jumping; add/archive still work; page is usable at tablet width.

## Phase 2 — Autosave (one save model)

**Goal:** Remove all "Save" buttons; edits persist automatically against the draft.

1. **`use-form-draft.ts` hook** owning:
   - `form` (server truth) and per-question `draft` edits.
   - `mutate` (moved from component) plus a **debounced `update_question`** (~600ms after last keystroke; flush immediately on blur, question switch, tab switch, and `beforeunload`).
   - Save status: `idle | saving | saved | error` exposed to the UI.
2. **Options autosave:** `OptionEditorRow` saves on blur/change (debounced `save_option`); delete its per-row Save button. Keep Remove.
3. **Checkboxes/selects** save immediately (no debounce needed).
4. **Status indicator:** small "Saving… / Saved / Couldn't save — retrying" text near the header or editor pane title. On error, keep local draft, show retry affordance; do not silently discard.
5. **Concurrency guard:** serialize saves per question (queue or latest-wins with an in-flight flag) so a debounce flush and a checkbox toggle can't race and clobber each other. Since `update_question` sends the full field set, always send from the freshest draft.
6. Remove the "Save changes" button and the `message` state's "Draft saved." usage (replaced by the indicator; errors move to toasts in Phase 5).

**Done when:** typing in any field, waiting a second, and reloading the page shows the change persisted; no Save buttons remain except "Publish draft".

## Phase 3 — Tabbed question editor

**Goal:** Split the ~20-field grid into four tabs. Tab state is per-editor, defaulting to Basics.

- **Basics:** title, answer type, description (with the existing Markdown preview), section, required.
- **Answers:** shown for option types (`dropdown`, `multi_select`, `multiple_choice`) — the current `OptionsEditor` including paste-a-list, with option **scores and N/A** kept here since they're per-answer. For `slider`/`integer`: min/max move here (they describe the answer range, not scoring).
- **Scoring:** scored/secondary-scored toggles, weight, offset, blank policy, multi-select scoring — each with a one-line plain-English helper, e.g.:
  - Weight: "How much this question counts toward the score, relative to other weights."
  - Offset: "Added to the raw answer before weighting."
  - Blank policy: "What happens when this is left blank: skip it and rebalance the other weights, or count it as zero."
  - **Weight share:** "≈ 12% of the overall score" computed as `weight / Σ(weights of overall-scored questions)`; same for secondary. Show "—" when unscored.
- **Logic:** conditions rendered as sentences — "**Show** this question when *{source question label}* equals *{option label or value}*" — resolving `sourceQuestionId` and option-id values to labels (fall back to raw value for numeric comparisons). Keep the add-condition row but reword it as a sentence builder: "Show/Disable this question when [question] equals [value]". Keep the "move a question above this one" empty state.
- **Misc placement:** stable key + "Allow N/A" + "RCA enabled" go at the bottom of Scoring (or Basics for key) — decide during implementation; keep them out of the way but not hidden behind `<details>`, which gets deleted.
- Tab labels can carry status hints (e.g. Logic tab shows a count badge when conditions exist).

**Done when:** every field from the current editor is reachable in exactly one tab, `<details>` is gone, and weight share renders correctly.

## Phase 4 — Preview as inspector

**Goal:** Preview reflects what you're editing, live.

1. **Single-question mode (default):** right of / below the editor (or a third pane at wide widths), render only the selected question via `QuestionRenderer`, **from the local draft state**, so unsaved keystrokes show instantly. Include label, required asterisk, help-text Markdown.
2. **Full-form mode:** toggle ("This question / Full form"). Full form renders grouped by section (fixing today's flat list), evaluates `evaluateFormConditions` against sample answers as today, highlights the selected question (accent ring), and scrolls it into view on selection change.
3. Sample answers (`answers` state) persist across mode switches so condition testing still works.
4. For the draft-state render, merge pending drafts over `form` (`form.questions` with the edited question replaced by its draft) before evaluating conditions.

**Done when:** typing a new title shows it in the preview immediately, and full-form mode shows sections and follows selection.

## Phase 5 — Interaction polish

1. **Drag and drop:**
   - Real drag handle (⠿) on each outline row; only the handle initiates drag.
   - Drop-position indicator line between rows while dragging.
   - Allow dropping into another section: send `reorder` with the new order **and** follow with `update_question { sectionId }` for the moved question (or extend the reorder action server-side if that two-step feels racy — only backend change in this plan, and it's optional).
   - Keyboard fallback: move up/down buttons or ↑/↓ while the handle is focused (accessibility).
2. **Toasts:** replace the top-of-page `message` `<p>` with a toast component (bottom corner, `role="status"`, auto-dismiss ~4s; errors persist until dismissed). Used for publish success/failure and save errors. Check whether the app already has a toast; if not, add a small `src/components/toast.tsx`.
3. **Archive safety:** move "Archive question" into an overflow area of the editor header (or the outline row's context), styled as destructive, with a confirm step ("Archive '{label}'? It will be removed from the draft."). Same treatment for archiving options is optional.
4. **Publish confirmation:** keep the button, add a confirm summarizing what publishing does ("Publishes draft v{id} as the live form"). Surface validation `errors[]` from the publish endpoint in the toast, one per line.

## Phase 6 — Section management

**Goal:** Create, rename, reorder, and archive sections from the outline pane. The master–detail layout (Phase 1) makes room for this.

**Backend** (`src/app/api/admin/form/route.ts` + `src/lib/admin-form.ts`):

1. `add_section` already exists. Add:
   - `update_section { sectionId, data: { title, description? } }`
   - `archive_section { sectionId }` — questions in the section move to unsectioned (set `sectionId = null`) rather than being archived; refuse or confirm nothing surprising happens to answers.
   - `reorder_sections { orderedIds }` — mirrors question `reorder`.
2. Extend publish validation if needed (e.g. no empty draft sections is fine to allow; don't block publish on them).
3. Tests alongside the existing route tests (`admin-routes.test.ts` pattern).

**Frontend (outline pane):**

1. "+ Add section" button at the bottom of the outline.
2. Section headers become editable: click-to-rename inline (autosaves via `update_section` through the Phase 2 hook).
3. Drag handle on section headers to reorder whole sections (`reorder_sections`); same drop-indicator treatment as questions, plus keyboard fallback.
4. Section overflow menu: Rename / Archive, with archive confirm noting its questions become unsectioned.

**Done when:** a section can be created, renamed, reordered, and archived entirely from the outline; archiving moves its questions to Unsectioned; reload persists everything.

## Phase 7 — Title & Divider display elements

**Goal:** Two new element types for organizing the form visually within sections: **Title** (a heading with optional Markdown description) and **Divider** (a horizontal rule). They are display-only: never answered, required, scored, or condition *sources* — but they can be condition *targets* (show/hide with the rest of a branch).

**Backend:**

1. Add `"title"` and `"divider"` to the question-type enum in `src/db/schema.ts` (requires a DB migration for the Postgres enum).
2. `src/lib/validation.ts` / `src/lib/admin-form.ts`: for display types, force `required: false`, `scored: false`, `secondaryScored: false`, no options, no min/max; reject them as condition sources; skip them in submission validation (`src/app/api/films/[id]/rating/route.ts` must not expect answers for them).
3. `src/lib/scoring.ts`: exclude display types from scoring and from `evaluateFormConditions` answer expectations (they still get visibility states as targets).
4. Publish validation: display elements don't count for any "form must have questions" checks.

**Frontend:**

1. `src/components/form/question-renderer.tsx` (or the form page that maps questions): render Title as a heading + Markdown description, Divider as a styled `<hr>`; no input, no label/asterisk. Verify the public form and `rating-editor.tsx` skip them when collecting answers.
2. Builder: add both to the add-question control, visually separated from answer types (e.g. an "Layout" group in the type dropdown). Outline rows show a distinct icon/badge and italic label so they read as structure, not questions.
3. Editor tabs collapse for display types: Title gets Basics (text + description) and Logic only; Divider gets Logic only (nothing to edit otherwise — selecting it can show just placement/logic).
4. Preview renders them in both single and full-form modes.
5. The `key` auto-generation and stable-key field still apply (they're rows in the same table); hide the key field for dividers.

**Done when:** a Title and Divider can be added, positioned by drag, shown/hidden by a condition, and render correctly on the public form; submissions ignore them; scoring output is unchanged by their presence.

## Sequencing & verification

Phases land in order; each is independently shippable. 1 → 2 first (layout + autosave = biggest payoff), then 3, 4, 5. Phases 6 and 7 come after the redesign settles, in either order (7 benefits from 6's outline affordances but doesn't depend on it).

After each phase:
- `npm run lint` / `tsc` and the existing test suites (`admin-routes.test.ts`, `phase2-routes.test.ts`) still pass.
- Manual pass in the browser: add / edit / reorder / condition / option / archive / publish round-trip, plus a reload to confirm persistence.
- Per `AGENTS.md`: consult `node_modules/next/dist/docs/` before touching any Next.js-level code (routing, Suspense, server components) — the page shell in `src/app/admin/form/page.tsx` should not need changes, but verify if it does.

## Out of scope

- Undo/restore for archived questions and sections.
- Multi-operator conditions (only `equals` today) and editing `conditionLogic`.
