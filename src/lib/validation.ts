import { z } from "zod";
import { filmStatuses, rcaAttributes, rcaPolarities } from "@/db/schema";

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

const score = z.number().int().min(0).max(100);
export const ratingSchema = z
  .object({
    story: score,
    direction: score,
    writing: score,
    acting: score,
    music: score,
    impact: score,
    rewatchability: score,
    genreFit: score,
    quality: score,
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
  attribute: z.enum(rcaAttributes),
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

export const rubricSchema = z.object({
  rubric: z
    .array(
      z.object({
        score: z.number().int().min(0).max(10),
        meaning: z.string().trim().min(1).max(500),
        examples: z.array(z.string().trim().min(1).max(200)).max(20),
      }),
    )
    .length(11)
    .refine(
      (rows) => new Set(rows.map(({ score }) => score)).size === 11,
      "Rubric must contain each score from 0 through 10 exactly once.",
    ),
});
