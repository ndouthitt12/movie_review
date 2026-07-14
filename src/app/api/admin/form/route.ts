import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  blankPolicies,
  conditionEffects,
  conditionLogics,
  conditionOperators,
  divisorModes,
  formSections,
  formVersions,
  multiSelectScorings,
  questionConditions,
  questionOptions,
  questions,
  questionTypes,
} from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  ensureDraftForm,
  nextQuestionSortOrder,
  reorderDraftQuestions,
} from "@/lib/admin-form";

const finite = z.number().finite();
const questionFields = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/).optional(),
  label: z.string().trim().min(1).max(300).optional(),
  helpText: z.string().trim().max(2000).optional(),
  type: z.enum(questionTypes).optional(),
  sectionId: z.number().int().positive().nullable().optional(),
  required: z.boolean().optional(),
  scored: z.boolean().optional(),
  weight: finite.nullable().optional(),
  secondaryScored: z.boolean().optional(),
  secondaryWeight: finite.nullable().optional(),
  min: finite.nullable().optional(),
  max: finite.nullable().optional(),
  offset: finite.optional(),
  secondaryOffset: finite.optional(),
  blankPolicy: z.enum(blankPolicies).optional(),
  secondaryBlankPolicy: z.enum(blankPolicies).optional(),
  multiSelectScoring: z.enum(multiSelectScorings).nullable().optional(),
  allowNa: z.boolean().optional(),
  conditionLogic: z.enum(conditionLogics).optional(),
  rcaEnabled: z.boolean().optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_form"),
    data: z.object({
      label: z.string().trim().min(1).max(200).optional(),
      divisorMode: z.enum(divisorModes).optional(),
      manualDivisor: finite.nullable().optional(),
      secondaryDivisorMode: z.enum(divisorModes).optional(),
      secondaryManualDivisor: finite.nullable().optional(),
    }),
  }),
  z.object({ action: z.literal("add_section"), data: z.object({ title: z.string().trim().min(1).max(200) }) }),
  z.object({
    action: z.literal("add_question"),
    data: questionFields.extend({
      key: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/),
      label: z.string().trim().min(1).max(300),
      type: z.enum(questionTypes),
    }),
  }),
  z.object({ action: z.literal("update_question"), questionId: z.number().int().positive(), data: questionFields }),
  z.object({
    action: z.literal("save_option"),
    questionId: z.number().int().positive(),
    optionId: z.number().int().positive().optional(),
    data: z.object({
      label: z.string().trim().min(1).max(300),
      valueScore: finite.nullable(),
      isNull: z.boolean(),
      sortOrder: z.number().int().min(0),
    }),
  }),
  z.object({ action: z.literal("archive_option"), optionId: z.number().int().positive() }),
  z.object({
    action: z.literal("add_condition"),
    questionId: z.number().int().positive(),
    data: z.object({
      sourceQuestionId: z.number().int().positive(),
      operator: z.enum(conditionOperators),
      value: z.union([finite, z.array(z.number().int().positive()).min(1)]).nullable(),
      effect: z.enum(conditionEffects),
    }),
  }),
  z.object({ action: z.literal("delete_condition"), conditionId: z.number().int().positive() }),
  z.object({ action: z.literal("archive_question"), questionId: z.number().int().positive() }),
  z.object({ action: z.literal("reorder"), orderedIds: z.array(z.number().int().positive()).min(1) }),
]);

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ form: ensureDraftForm() });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid form change." }, { status: 400 });

  const draft = ensureDraftForm();
  try {
    switch (parsed.data.action) {
      case "update_form":
        db.update(formVersions).set(parsed.data.data).where(eq(formVersions.id, draft.id)).run();
        break;
      case "add_section": {
        const sortOrder = (draft.sections.at(-1)?.sortOrder ?? 0) + 10;
        db.insert(formSections).values({ formVersionId: draft.id, title: parsed.data.data.title, sortOrder }).run();
        break;
      }
      case "add_question": {
        const data = parsed.data.data;
        if (data.sectionId && !draft.sections.some(({ id }) => id === data.sectionId))
          throw new Error("Section does not belong to the draft form.");
        db.insert(questions).values({
          formVersionId: draft.id,
          sortOrder: nextQuestionSortOrder(draft.id),
          helpText: "",
          required: false,
          scored: false,
          weight: null,
          secondaryScored: false,
          secondaryWeight: null,
          min: data.type === "slider" ? 0 : null,
          max: data.type === "slider" ? 100 : null,
          offset: 0,
          secondaryOffset: 0,
          blankPolicy: "exclude_and_renormalize",
          secondaryBlankPolicy: "exclude_and_renormalize",
          multiSelectScoring: data.type === "multi_select" ? "avg" : null,
          allowNa: false,
          conditionLogic: "all",
          rcaEnabled: false,
          ...data,
        }).run();
        break;
      }
      case "update_question": {
        const data = parsed.data.data;
        assertDraftQuestion(draft, parsed.data.questionId);
        if (data.sectionId && !draft.sections.some(({ id }) => id === data.sectionId))
          throw new Error("Section does not belong to the draft form.");
        if (data.min != null && data.max != null && data.min > data.max)
          throw new Error("Minimum must not exceed maximum.");
        db.update(questions).set(data).where(eq(questions.id, parsed.data.questionId)).run();
        break;
      }
      case "save_option": {
        const optionId = parsed.data.optionId;
        const question = assertDraftQuestion(draft, parsed.data.questionId);
        if (parsed.data.data.isNull && parsed.data.data.valueScore != null)
          throw new Error("A null response option cannot have a score.");
        if (optionId) {
          if (!question.options.some(({ id }) => id === optionId)) throw new Error("Option does not belong to the draft question.");
          db.update(questionOptions).set(parsed.data.data).where(eq(questionOptions.id, optionId)).run();
        } else db.insert(questionOptions).values({ questionId: question.id, ...parsed.data.data }).run();
        break;
      }
      case "archive_option": {
        const option = db.select({ questionId: questionOptions.questionId }).from(questionOptions).where(eq(questionOptions.id, parsed.data.optionId)).get();
        if (!option) throw new Error("Option not found.");
        assertDraftQuestion(draft, option.questionId);
        db.update(questionOptions).set({ archivedAt: new Date().toISOString() }).where(eq(questionOptions.id, parsed.data.optionId)).run();
        break;
      }
      case "add_condition": {
        const target = assertDraftQuestion(draft, parsed.data.questionId);
        const source = assertDraftQuestion(draft, parsed.data.data.sourceQuestionId);
        if (source.sortOrder >= target.sortOrder) throw new Error("A condition source must appear before its target question.");
        db.insert(questionConditions).values({ questionId: target.id, ...parsed.data.data }).run();
        break;
      }
      case "delete_condition": {
        const condition = db.select({ questionId: questionConditions.questionId }).from(questionConditions).where(eq(questionConditions.id, parsed.data.conditionId)).get();
        if (!condition) throw new Error("Condition not found.");
        assertDraftQuestion(draft, condition.questionId);
        db.delete(questionConditions).where(eq(questionConditions.id, parsed.data.conditionId)).run();
        break;
      }
      case "archive_question":
        assertDraftQuestion(draft, parsed.data.questionId);
        db.update(questions).set({ archivedAt: new Date().toISOString() }).where(eq(questions.id, parsed.data.questionId)).run();
        break;
      case "reorder":
        return NextResponse.json({ form: reorderDraftQuestions(parsed.data.orderedIds) });
    }
    return NextResponse.json({ form: ensureDraftForm() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update draft." }, { status: 400 });
  }
}

function assertDraftQuestion(draft: ReturnType<typeof ensureDraftForm>, id: number) {
  const question = draft.questions.find((candidate) => candidate.id === id);
  if (!question) throw new Error("Question does not belong to the draft form.");
  return question;
}
