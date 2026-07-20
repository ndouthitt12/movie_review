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
  displayQuestionTypes,
  ensureDraftForm,
  nextQuestionSortOrder,
  reorderDraftQuestions,
  reorderDraftSections,
} from "@/lib/admin-form";
import { isButtonScaleStoredValue } from "@/lib/button-scale";

const finite = z.number().finite();
const optionQuestionTypes = new Set([
  "dropdown",
  "multiple_choice",
  "multi_select",
]);
const questionFields = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
  label: z.string().trim().min(1).max(300).optional(),
  helpText: z.string().trim().max(2000).optional(),
  type: z.enum(questionTypes).optional(),
  scaleMinLabel: z.string().trim().max(100).optional(),
  scaleMaxLabel: z.string().trim().max(100).optional(),
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
  z.object({
    action: z.literal("add_section"),
    data: z.object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(1000).optional(),
    }),
  }),
  z.object({
    action: z.literal("update_section"),
    sectionId: z.number().int().positive(),
    data: z
      .object({
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(1000).optional(),
      })
      .refine((data) => Object.keys(data).length > 0, "No changes supplied."),
  }),
  z.object({
    action: z.literal("archive_section"),
    sectionId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("reorder_sections"),
    orderedIds: z.array(z.number().int().positive()).min(1),
  }),
  z.object({
    action: z.literal("add_question"),
    data: questionFields.extend({
      key: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .regex(/^[a-z][a-z0-9_]*$/),
      label: z.string().trim().min(1).max(300),
      type: z.enum(questionTypes),
    }),
  }),
  z.object({
    action: z.literal("update_question"),
    questionId: z.number().int().positive(),
    data: questionFields,
  }),
  z.object({
    action: z.literal("add_options"),
    questionId: z.number().int().positive(),
    labels: z.array(z.string().trim().min(1).max(300)).min(1).max(100),
  }),
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
  z.object({
    action: z.literal("archive_option"),
    optionId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("add_condition"),
    questionId: z.number().int().positive(),
    data: z.object({
      sourceQuestionId: z.number().int().positive(),
      operator: z.enum(conditionOperators),
      value: z
        .union([finite, z.array(z.number().int().positive()).min(1)])
        .nullable(),
      effect: z.enum(conditionEffects),
    }),
  }),
  z.object({
    action: z.literal("delete_condition"),
    conditionId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("archive_question"),
    questionId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("reorder"),
    orderedIds: z.array(z.number().int().positive()).min(1),
    moved: z
      .object({
        questionId: z.number().int().positive(),
        sectionId: z.number().int().positive().nullable(),
      })
      .optional(),
  }),
]);

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ form: await ensureDraftForm() });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid form change." },
      { status: 400 },
    );

  const draft = await ensureDraftForm();
  try {
    switch (parsed.data.action) {
      case "update_form":
        await db
          .update(formVersions)
          .set(parsed.data.data)
          .where(eq(formVersions.id, draft.id));
        break;
      case "add_section": {
        const sortOrder = (draft.sections.at(-1)?.sortOrder ?? 0) + 10;
        await db.insert(formSections).values({
          formVersionId: draft.id,
          title: parsed.data.data.title,
          description: parsed.data.data.description ?? "",
          sortOrder,
        });
        break;
      }
      case "update_section":
        assertDraftSection(draft, parsed.data.sectionId);
        await db
          .update(formSections)
          .set(parsed.data.data)
          .where(eq(formSections.id, parsed.data.sectionId));
        break;
      case "archive_section": {
        const sectionId = parsed.data.sectionId;
        assertDraftSection(draft, sectionId);
        await db.transaction(async (tx) => {
          await tx
            .update(questions)
            .set({ sectionId: null })
            .where(eq(questions.sectionId, sectionId));
          await tx.delete(formSections).where(eq(formSections.id, sectionId));
        });
        break;
      }
      case "reorder_sections":
        return NextResponse.json({
          form: await reorderDraftSections(parsed.data.orderedIds),
        });
      case "add_question": {
        const data = parsed.data.data;
        if (
          data.sectionId &&
          !draft.sections.some(({ id }) => id === data.sectionId)
        )
          throw new Error("Section does not belong to the draft form.");
        const display = displayQuestionTypes.has(data.type);
        await db.insert(questions).values({
          formVersionId: draft.id,
          sortOrder: await nextQuestionSortOrder(draft.id),
          helpText: "",
          required: !display,
          scored: false,
          weight: null,
          secondaryScored: false,
          secondaryWeight: null,
          min:
            data.type === "slider"
              ? 0
              : data.type === "button_scale"
                ? 10
                : null,
          max:
            data.type === "slider" || data.type === "button_scale" ? 100 : null,
          offset: 0,
          secondaryOffset: 0,
          blankPolicy: "exclude_and_renormalize",
          secondaryBlankPolicy: "exclude_and_renormalize",
          multiSelectScoring: data.type === "multi_select" ? "avg" : null,
          allowNa: false,
          conditionLogic: "all",
          rcaEnabled: false,
          ...data,
          ...(display
            ? {
                required: false,
                scored: false,
                weight: null,
                secondaryScored: false,
                secondaryWeight: null,
                min: null,
                max: null,
                offset: 0,
                secondaryOffset: 0,
                multiSelectScoring: null,
                allowNa: false,
                rcaEnabled: false,
              }
            : {}),
        });
        break;
      }
      case "update_question": {
        const data = parsed.data.data;
        const questionId = parsed.data.questionId;
        const question = assertDraftQuestion(draft, questionId);
        if (
          data.sectionId &&
          !draft.sections.some(({ id }) => id === data.sectionId)
        )
          throw new Error("Section does not belong to the draft form.");
        if (data.min != null && data.max != null && data.min > data.max)
          throw new Error("Minimum must not exceed maximum.");
        const nextType = data.type ?? question.type;
        const display = displayQuestionTypes.has(nextType);
        if (
          display &&
          draft.questions.some((target) =>
            target.conditions.some(
              ({ sourceQuestionId }) => sourceQuestionId === question.id,
            ),
          )
        )
          throw new Error(
            "A question used as a condition source cannot become a display element.",
          );
        const normalized = display
          ? {
              ...data,
              required: false,
              scored: false,
              weight: null,
              secondaryScored: false,
              secondaryWeight: null,
              min: null,
              max: null,
              offset: 0,
              secondaryOffset: 0,
              multiSelectScoring: null,
              allowNa: false,
              rcaEnabled: false,
            }
          : nextType === "button_scale"
            ? { ...data, min: 10, max: 100 }
            : data;
        await db.transaction(async (tx) => {
          await tx
            .update(questions)
            .set(normalized)
            .where(eq(questions.id, questionId));
          if (display)
            await tx
              .update(questionOptions)
              .set({ archivedAt: new Date().toISOString() })
              .where(eq(questionOptions.questionId, questionId));
        });
        break;
      }
      case "add_options": {
        const question = assertDraftQuestion(draft, parsed.data.questionId);
        if (!optionQuestionTypes.has(question.type))
          throw new Error("This question type does not support options.");
        const existingLabels = new Set(
          question.options.map(({ label }) => label.trim().toLocaleLowerCase()),
        );
        const labels = parsed.data.labels.filter((label) => {
          const normalized = label.toLocaleLowerCase();
          if (existingLabels.has(normalized)) return false;
          existingLabels.add(normalized);
          return true;
        });
        if (!labels.length) throw new Error("Those options already exist.");
        const start = (question.options.at(-1)?.sortOrder ?? 0) + 10;
        await db.insert(questionOptions).values(
          labels.map((label, index) => ({
            questionId: question.id,
            label,
            valueScore: 0,
            isNull: false,
            sortOrder: start + index * 10,
          })),
        );
        break;
      }
      case "save_option": {
        const optionId = parsed.data.optionId;
        const question = assertDraftQuestion(draft, parsed.data.questionId);
        if (!optionQuestionTypes.has(question.type))
          throw new Error("This question type does not support options.");
        if (parsed.data.data.isNull && parsed.data.data.valueScore != null)
          throw new Error("A null response option cannot have a score.");
        if (optionId) {
          if (!question.options.some(({ id }) => id === optionId))
            throw new Error("Option does not belong to the draft question.");
          await db
            .update(questionOptions)
            .set(parsed.data.data)
            .where(eq(questionOptions.id, optionId));
        } else
          await db
            .insert(questionOptions)
            .values({ questionId: question.id, ...parsed.data.data });
        break;
      }
      case "archive_option": {
        const [option] = await db
          .select({ questionId: questionOptions.questionId })
          .from(questionOptions)
          .where(eq(questionOptions.id, parsed.data.optionId))
          .limit(1);
        if (!option) throw new Error("Option not found.");
        assertDraftQuestion(draft, option.questionId);
        await db
          .update(questionOptions)
          .set({ archivedAt: new Date().toISOString() })
          .where(eq(questionOptions.id, parsed.data.optionId));
        break;
      }
      case "add_condition": {
        const target = assertDraftQuestion(draft, parsed.data.questionId);
        const source = assertDraftQuestion(
          draft,
          parsed.data.data.sourceQuestionId,
        );
        if (displayQuestionTypes.has(source.type))
          throw new Error("A display element cannot be a condition source.");
        if (source.sortOrder >= target.sortOrder)
          throw new Error(
            "A condition source must appear before its target question.",
          );
        if (
          source.type === "button_scale" &&
          (typeof parsed.data.data.value !== "number" ||
            !isButtonScaleStoredValue(parsed.data.data.value))
        )
          throw new Error(
            "A button-scale condition must use a value from 1 to 10 in half-point steps.",
          );
        await db
          .insert(questionConditions)
          .values({ questionId: target.id, ...parsed.data.data });
        break;
      }
      case "delete_condition": {
        const [condition] = await db
          .select({ questionId: questionConditions.questionId })
          .from(questionConditions)
          .where(eq(questionConditions.id, parsed.data.conditionId))
          .limit(1);
        if (!condition) throw new Error("Condition not found.");
        assertDraftQuestion(draft, condition.questionId);
        await db
          .delete(questionConditions)
          .where(eq(questionConditions.id, parsed.data.conditionId));
        break;
      }
      case "archive_question":
        assertDraftQuestion(draft, parsed.data.questionId);
        await db
          .update(questions)
          .set({ archivedAt: new Date().toISOString() })
          .where(eq(questions.id, parsed.data.questionId));
        break;
      case "reorder":
        return NextResponse.json({
          form: await reorderDraftQuestions(
            parsed.data.orderedIds,
            parsed.data.moved,
          ),
        });
    }
    return NextResponse.json({ form: await ensureDraftForm() });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update draft.",
      },
      { status: 400 },
    );
  }
}

function assertDraftSection(
  draft: Awaited<ReturnType<typeof ensureDraftForm>>,
  id: number,
) {
  const section = draft.sections.find((candidate) => candidate.id === id);
  if (!section) throw new Error("Section does not belong to the draft form.");
  return section;
}

function assertDraftQuestion(
  draft: Awaited<ReturnType<typeof ensureDraftForm>>,
  id: number,
) {
  const question = draft.questions.find((candidate) => candidate.id === id);
  if (!question) throw new Error("Question does not belong to the draft form.");
  return question;
}
