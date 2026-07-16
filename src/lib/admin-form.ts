import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  formSections,
  formVersions,
  questionConditions,
  questionOptions,
  questions,
  type DivisorMode,
} from "@/db/schema";
import {
  getDraftRuntimeForm,
  getPublishedRuntimeForm,
  type RuntimeFormConfig,
} from "./form-config";

const optionTypes = new Set(["dropdown", "multiple_choice", "multi_select"]);
export const displayQuestionTypes = new Set(["title", "divider"]);

export async function ensureDraftForm(): Promise<RuntimeFormConfig> {
  const existing = await getDraftRuntimeForm();
  if (existing) return existing;

  const published = await getPublishedRuntimeForm();
  if (!published)
    throw new Error("A published form is required before creating a draft.");

  await db.transaction(async (tx) => {
    const [version] = await tx
      .insert(formVersions)
      .values({
        label: `${published.label} — draft`,
        status: "draft",
        divisorMode: published.divisorMode,
        manualDivisor: published.manualDivisor,
        secondaryDivisorMode: published.secondaryDivisorMode,
        secondaryManualDivisor: published.secondaryManualDivisor,
      })
      .returning({ id: formVersions.id });
    if (!version) throw new Error("Could not create a draft form version.");

    const sectionIds = new Map<number, number>();
    for (const section of published.sections) {
      const [copied] = await tx
        .insert(formSections)
        .values({
          formVersionId: version.id,
          title: section.title,
          description: section.description,
          sortOrder: section.sortOrder,
        })
        .returning({ id: formSections.id });
      if (!copied) throw new Error("Could not copy a form section.");
      sectionIds.set(section.id, copied.id);
    }

    const questionIds = new Map<number, number>();
    for (const question of published.questions) {
      const [copied] = await tx
        .insert(questions)
        .values({
          formVersionId: version.id,
          key: question.key,
          label: question.label,
          helpText: question.helpText,
          type: question.type,
          sectionId: question.sectionId
            ? sectionIds.get(question.sectionId)
            : null,
          sortOrder: question.sortOrder,
          required: question.required,
          scored: question.scored,
          weight: question.weight,
          secondaryScored: question.secondaryScored,
          secondaryWeight: question.secondaryWeight,
          min: question.min,
          max: question.max,
          offset: question.offset,
          secondaryOffset: question.secondaryOffset,
          blankPolicy: question.blankPolicy,
          secondaryBlankPolicy: question.secondaryBlankPolicy,
          multiSelectScoring: question.multiSelectScoring,
          allowNa: question.allowNa,
          conditionLogic: question.conditionLogic,
          rcaEnabled: question.rcaEnabled,
        })
        .returning({ id: questions.id });
      if (!copied) throw new Error("Could not copy a form question.");
      questionIds.set(question.id, copied.id);

      if (question.options.length) {
        await tx.insert(questionOptions).values(
          question.options.map((option) => ({
            questionId: copied.id,
            label: option.label,
            valueScore: option.valueScore,
            isNull: option.isNull,
            sortOrder: option.sortOrder,
          })),
        );
      }
    }

    for (const question of published.questions) {
      const targetId = questionIds.get(question.id)!;
      if (question.conditions.length) {
        await tx.insert(questionConditions).values(
          question.conditions.map((condition) => ({
            questionId: targetId,
            sourceQuestionId: questionIds.get(condition.sourceQuestionId)!,
            operator: condition.operator,
            value: condition.value,
            effect: condition.effect,
          })),
        );
      }
    }
  });

  const draft = await getDraftRuntimeForm();
  if (!draft) throw new Error("Could not load the new draft form.");
  return draft;
}

export function validateFormForPublish(form: RuntimeFormConfig): string[] {
  const errors: string[] = [];
  const active = form.questions.filter((question) => !question.archivedAt);
  const answerQuestions = active.filter(
    (question) => !displayQuestionTypes.has(question.type),
  );
  const activeIds = new Set(active.map(({ id }) => id));

  for (const question of active) {
    if (displayQuestionTypes.has(question.type)) {
      if (
        question.required ||
        question.scored ||
        question.secondaryScored ||
        question.options.length
      )
        errors.push(
          `Display element “${question.label}” cannot be required, scored, or have options.`,
        );
    }
    if (question.scored && question.weight == null)
      errors.push(`Primary score: “${question.label}” requires a weight.`);
    if (question.secondaryScored && question.secondaryWeight == null)
      errors.push(`Secondary score: “${question.label}” requires a weight.`);

    if (optionTypes.has(question.type)) {
      const nonNull = question.options.filter((option) => !option.isNull);
      if (question.scored || question.secondaryScored) {
        if (!nonNull.length)
          errors.push(
            `Scored option question “${question.label}” requires at least one non-null option.`,
          );
        if (nonNull.some((option) => option.valueScore == null))
          errors.push(
            `Every non-null option for scored question “${question.label}” requires a score.`,
          );
      }
    }

    for (const condition of question.conditions) {
      const source = active.find(({ id }) => id === condition.sourceQuestionId);
      if (!source || !activeIds.has(condition.sourceQuestionId)) {
        errors.push(
          `Condition on “${question.label}” has a source outside this form version.`,
        );
      } else if (source.sortOrder >= question.sortOrder) {
        errors.push(
          `Condition source “${source.label}” must appear before “${question.label}”.`,
        );
      } else if (displayQuestionTypes.has(source.type))
        errors.push(
          `Display element “${source.label}” cannot be a condition source.`,
        );
    }
  }

  const edges = new Map(active.map(({ id }) => [id, [] as number[]]));
  for (const target of active)
    for (const condition of target.conditions)
      if (edges.has(condition.sourceQuestionId))
        edges.get(condition.sourceQuestionId)!.push(target.id);
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const cyclic = (id: number): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((edges.get(id) ?? []).some(cyclic)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  if (active.some(({ id }) => cyclic(id)))
    errors.push("Question conditions must be acyclic.");

  validateDivisor(
    "Primary score",
    form.divisorMode,
    form.manualDivisor,
    answerQuestions.filter((q) => q.scored).length,
    errors,
  );
  validateDivisor(
    "Secondary score",
    form.secondaryDivisorMode,
    form.secondaryManualDivisor,
    answerQuestions.filter((q) => q.secondaryScored).length,
    errors,
  );
  return [...new Set(errors)];
}

function validateDivisor(
  name: string,
  mode: DivisorMode,
  manual: number | null,
  scoredCount: number,
  errors: string[],
) {
  if (
    mode === "manual" &&
    (manual == null || !Number.isFinite(manual) || manual <= 0)
  )
    errors.push(`${name} manual divisor must be greater than zero.`);
  if (mode === "auto" && scoredCount < 1)
    errors.push(`${name} auto divisor requires at least one scored question.`);
}

export async function publishDraftForm() {
  const draft = await getDraftRuntimeForm();
  if (!draft) return { errors: ["No draft form exists."] };
  const errors = validateFormForPublish(draft);
  if (errors.length) return { errors };

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx
      .update(formVersions)
      .set({ status: "archived" })
      .where(
        and(
          eq(formVersions.status, "published"),
          ne(formVersions.id, draft.id),
        ),
      );
    await tx
      .update(formVersions)
      .set({ status: "published", publishedAt: now })
      .where(eq(formVersions.id, draft.id));
  });
  const form = await getPublishedRuntimeForm();
  return { errors: [], form };
}

export async function nextQuestionSortOrder(formVersionId: number) {
  const rows = await db
    .select({ sortOrder: questions.sortOrder })
    .from(questions)
    .where(
      and(
        eq(questions.formVersionId, formVersionId),
        isNull(questions.archivedAt),
      ),
    )
    .orderBy(asc(questions.sortOrder));
  return rows.length ? rows[rows.length - 1]!.sortOrder + 10 : 10;
}

export async function reorderDraftQuestions(
  orderedIds: number[],
  moved?: { questionId: number; sectionId: number | null },
) {
  const draft = await ensureDraftForm();
  const activeIds = draft.questions
    .filter((q) => !q.archivedAt)
    .map(({ id }) => id);
  if (
    orderedIds.length !== activeIds.length ||
    orderedIds.some((id) => !activeIds.includes(id))
  )
    throw new Error(
      "Reorder must include every active draft question exactly once.",
    );
  if (moved) {
    if (!activeIds.includes(moved.questionId))
      throw new Error("Moved question does not belong to the draft form.");
    if (
      moved.sectionId != null &&
      !draft.sections.some(({ id }) => id === moved.sectionId)
    )
      throw new Error("Section does not belong to the draft form.");
  }

  const proposed = new Map(
    orderedIds.map((id, index) => [id, (index + 1) * 10]),
  );
  for (const target of draft.questions)
    for (const condition of target.conditions)
      if (
        (proposed.get(condition.sourceQuestionId) ?? Infinity) >=
        (proposed.get(target.id) ?? -Infinity)
      ) {
        const source = draft.questions.find(
          ({ id }) => id === condition.sourceQuestionId,
        );
        throw new Error(
          `Cannot move “${target.label}” before its condition source “${source?.label ?? "unknown"}”.`,
        );
      }

  await db.transaction(async (tx) => {
    for (const [id, sortOrder] of proposed)
      await tx.update(questions).set({ sortOrder }).where(eq(questions.id, id));
    if (moved)
      await tx
        .update(questions)
        .set({ sectionId: moved.sectionId })
        .where(eq(questions.id, moved.questionId));
  });
  const reordered = await getDraftRuntimeForm();
  if (!reordered) throw new Error("Could not reload the reordered draft form.");
  return reordered;
}

export async function reorderDraftSections(orderedIds: number[]) {
  const draft = await ensureDraftForm();
  const activeIds = draft.sections.map(({ id }) => id);
  if (
    orderedIds.length !== activeIds.length ||
    orderedIds.some((id) => !activeIds.includes(id))
  )
    throw new Error("Reorder must include every draft section exactly once.");

  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries())
      await tx
        .update(formSections)
        .set({ sortOrder: (index + 1) * 10 })
        .where(eq(formSections.id, id));
  });
  const reordered = await getDraftRuntimeForm();
  if (!reordered) throw new Error("Could not reload the reordered draft form.");
  return reordered;
}

export async function draftQuestionIds(formVersionId: number, ids: number[]) {
  if (!ids.length) return [];
  return (
    await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(
          eq(questions.formVersionId, formVersionId),
          inArray(questions.id, ids),
        ),
      )
  ).map(({ id }) => id);
}
