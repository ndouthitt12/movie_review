import { z } from "zod";
import {
  blankPolicies,
  conditionEffects,
  conditionLogics,
  conditionOperators,
  filmStatuses,
  multiSelectScorings,
  questionTypes,
  rcaPolarities,
} from "@/db/schema";

const optionalText = z.string().trim().max(5000).nullable().optional();

export const filmCreateSchema = z.object({
  tmdbId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  releaseYear: z.number().int().min(1888).max(2200),
  status: z.enum(filmStatuses),
  watchOrder: z.number().int().min(0).nullable().optional(),
  genrePrimary: z.string().trim().max(80).nullable().optional(),
  genreSecondary: z.string().trim().max(80).nullable().optional(),
  franchiseName: z.string().trim().max(120).nullable().optional(),
  subFranchiseName: z.string().trim().max(120).nullable().optional(),
  notes: optionalText,
  posterPath: optionalText,
  backdropPath: optionalText,
  runtime: z.number().int().positive().max(1000).nullable().optional(),
  director: z.string().trim().max(200).nullable().optional(),
  overview: optionalText,
  tmdbGenres: z.array(z.string().trim().max(80)).max(30).optional(),
});

export const filmUpdateSchema = z
  .object({
    status: z.enum(filmStatuses).optional(),
    notes: z.string().max(20_000).optional(),
    genrePrimary: z.string().trim().max(80).nullable().optional(),
    genreSecondary: z.string().trim().max(80).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied");

const finiteNumber = z.number().finite();

export const questionSchema = z
  .object({
    id: z.number().int().positive().optional(),
    formVersionId: z.number().int().positive(),
    key: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(
        /^[a-z][a-z0-9_]*$/,
        "Question key must be a lowercase slug using underscores.",
      ),
    label: z.string().trim().min(1).max(300),
    helpText: z.string().trim().max(2000).default(""),
    type: z.enum(questionTypes),
    sectionId: z.number().int().positive().nullable().optional(),
    sortOrder: z.number().int().min(0),
    required: z.boolean().default(true),
    scored: z.boolean().default(false),
    weight: finiteNumber.nullable().default(null),
    secondaryScored: z.boolean().default(false),
    secondaryWeight: finiteNumber.nullable().default(null),
    min: finiteNumber.nullable().default(null),
    max: finiteNumber.nullable().default(null),
    offset: finiteNumber.default(0),
    secondaryOffset: finiteNumber.default(0),
    blankPolicy: z.enum(blankPolicies).default("exclude_and_renormalize"),
    secondaryBlankPolicy: z
      .enum(blankPolicies)
      .default("exclude_and_renormalize"),
    multiSelectScoring: z.enum(multiSelectScorings).nullable().default(null),
    allowNa: z.boolean().default(false),
    conditionLogic: z.enum(conditionLogics).default("all"),
    rcaEnabled: z.boolean().default(false),
    archivedAt: z.string().nullable().optional(),
  })
  .superRefine((question, context) => {
    const display = question.type === "title" || question.type === "divider";
    if (!display && question.scored && question.weight == null) {
      context.addIssue({
        code: "custom",
        message: "A scored question requires a weight.",
        path: ["weight"],
      });
    }
    if (
      !display &&
      question.secondaryScored &&
      question.secondaryWeight == null
    ) {
      context.addIssue({
        code: "custom",
        message: "A secondary-scored question requires a secondary weight.",
        path: ["secondaryWeight"],
      });
    }
    if (
      (question.type === "short_text" || question.type === "paragraph") &&
      (question.scored || question.secondaryScored)
    ) {
      context.addIssue({
        code: "custom",
        message: "Text questions cannot be scored.",
        path: ["scored"],
      });
    }
    if (
      !display &&
      question.min != null &&
      question.max != null &&
      question.min > question.max
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum must not exceed maximum.",
        path: ["min"],
      });
    }
    if (
      !display &&
      question.type === "multi_select" &&
      question.scored &&
      question.multiSelectScoring == null
    ) {
      context.addIssue({
        code: "custom",
        message: "A scored multi-select question requires sum or avg scoring.",
        path: ["multiSelectScoring"],
      });
    }
  })
  .transform((question) => {
    if (question.type === "slider")
      return { ...question, min: question.min ?? 0, max: question.max ?? 100 };
    if (question.type === "title" || question.type === "divider")
      return {
        ...question,
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
      };
    return question;
  });

export const questionOptionSchema = z
  .object({
    id: z.number().int().positive().optional(),
    questionId: z.number().int().positive(),
    label: z.string().trim().min(1).max(300),
    valueScore: finiteNumber.nullable().default(null),
    isNull: z.boolean().default(false),
    sortOrder: z.number().int().min(0),
    archivedAt: z.string().nullable().optional(),
    parentScored: z.boolean().optional(),
  })
  .superRefine((option, context) => {
    if (option.isNull && option.valueScore != null) {
      context.addIssue({
        code: "custom",
        message: "A null response option cannot have a score.",
        path: ["valueScore"],
      });
    }
    if (
      option.parentScored &&
      !option.isNull &&
      option.archivedAt == null &&
      option.valueScore == null
    ) {
      context.addIssue({
        code: "custom",
        message: "A scored question's option requires a value score.",
        path: ["valueScore"],
      });
    }
  });

export const conditionSchema = z
  .object({
    id: z.number().int().positive().optional(),
    questionId: z.number().int().positive(),
    sourceQuestionId: z.number().int().positive(),
    operator: z.enum(conditionOperators),
    value: z
      .union([
        finiteNumber,
        z.array(z.number().int().positive()).min(1).max(100),
      ])
      .nullable(),
    effect: z.enum(conditionEffects),
    sourceSortOrder: z.number().int().min(0).optional(),
    targetSortOrder: z.number().int().min(0).optional(),
  })
  .superRefine((condition, context) => {
    if (condition.questionId === condition.sourceQuestionId) {
      context.addIssue({
        code: "custom",
        message: "A question cannot depend on itself.",
        path: ["sourceQuestionId"],
      });
    }
    if (
      condition.sourceSortOrder != null &&
      condition.targetSortOrder != null &&
      condition.sourceSortOrder >= condition.targetSortOrder
    ) {
      context.addIssue({
        code: "custom",
        message: "A condition source must appear before its target question.",
        path: ["sourceQuestionId"],
      });
    }
  });

export const answerSchema = z
  .object({
    questionId: z.number().int().positive(),
    valueNumber: finiteNumber.nullable().optional(),
    valueText: z.string().max(20_000).nullable().optional(),
    valueOptionIds: z
      .array(z.number().int().positive())
      .max(100)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Option ids must be unique.",
      )
      .nullable()
      .optional(),
    isNa: z.boolean().default(false),
  })
  .superRefine((answer, context) => {
    const populated = [
      answer.valueNumber != null,
      answer.valueText != null && answer.valueText.length > 0,
      answer.valueOptionIds != null && answer.valueOptionIds.length > 0,
    ].filter(Boolean).length;
    if (answer.isNa && populated > 0) {
      context.addIssue({
        code: "custom",
        message: "An N/A answer cannot also contain a value.",
        path: ["isNa"],
      });
    }
    if (!answer.isNa && populated > 1) {
      context.addIssue({
        code: "custom",
        message: "An answer must use only one value field.",
      });
    }
  });

export const ratingSchema = z
  .object({
    formVersionId: z.number().int().positive(),
    answers: z
      .array(answerSchema)
      .max(500)
      .refine(
        (rows) =>
          new Set(rows.map(({ questionId }) => questionId)).size ===
          rows.length,
        "Each question may only be answered once.",
      ),
    promoteToWatched: z.boolean().optional().default(false),
    watchedOn: z.iso.date().optional(),
    rcaTagIds: z.array(z.number().int().positive()).max(100).default([]),
  })
  .refine((value) => !value.promoteToWatched || value.watchedOn, {
    message: "A local watch date is required when moving a film to Watched.",
    path: ["watchedOn"],
  });

export const watchSchema = z.object({
  watchedOn: z.iso.date(),
  isRewatch: z.boolean(),
});

export const reorderSchema = z.object({
  filmIds: z.array(z.number().int().positive()).min(1),
});

const optionalColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a six-digit hex value.")
  .nullable()
  .optional();

export const rcaTagCreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  questionKey: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/),
  polarity: z.enum(rcaPolarities),
  color: optionalColor,
});

export const rcaTagUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    polarity: z.enum(rcaPolarities).optional(),
    color: optionalColor,
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied");

export const rcaTagMergeSchema = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
});

export const rcaTagReorderSchema = z.object({
  orderedIds: z
    .array(z.number().int().positive())
    .min(1)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Tag ids must be unique.",
    ),
});
