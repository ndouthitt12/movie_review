import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const filmStatuses = ["watched", "to_watch", "to_rewatch"] as const;
export const rcaAttributes = [
  "story",
  "direction",
  "writing",
  "acting",
  "music",
  "impact",
  "rewatchability",
  "genre_fit",
  "overall",
] as const;
export const rcaPolarities = ["positive", "negative", "neutral"] as const;
export const formVersionStatuses = ["draft", "published", "archived"] as const;
export const questionTypes = [
  "slider",
  "short_text",
  "paragraph",
  "dropdown",
  "multi_select",
  "multiple_choice",
  "integer",
] as const;
export const conditionOperators = [
  "equals",
  "not_equals",
  "in",
  "answered",
  "gte",
  "lte",
] as const;
export const conditionEffects = ["show", "disable"] as const;
export const conditionLogics = ["all", "any"] as const;
export const blankPolicies = [
  "treat_as_zero",
  "exclude_and_renormalize",
] as const;
export const multiSelectScorings = ["sum", "avg"] as const;
export const divisorModes = ["auto", "manual"] as const;

export type QuestionType = (typeof questionTypes)[number];
export type ConditionOperator = (typeof conditionOperators)[number];
export type ConditionEffect = (typeof conditionEffects)[number];
export type ConditionLogic = (typeof conditionLogics)[number];
export type BlankPolicy = (typeof blankPolicies)[number];
export type MultiSelectScoring = (typeof multiSelectScorings)[number];
export type DivisorMode = (typeof divisorModes)[number];

export const franchises = pgTable(
  "franchises",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    parentId: integer("parent_id").references(
      (): AnyPgColumn => franchises.id,
      {
        onDelete: "cascade",
      },
    ),
  },
  (table) => [
    uniqueIndex("franchises_name_parent_unique").on(table.name, table.parentId),
    index("franchises_parent_idx").on(table.parentId),
  ],
);

export const films = pgTable(
  "films",
  {
    id: serial("id").primaryKey(),
    tmdbId: integer("tmdb_id"),
    title: text("title").notNull(),
    releaseYear: integer("release_year").notNull(),
    status: text("status", { enum: filmStatuses }).notNull(),
    watchOrder: integer("watch_order"),
    lastWatchDate: text("last_watch_date"),
    genrePrimary: text("genre_primary"),
    genreSecondary: text("genre_secondary"),
    franchiseId: integer("franchise_id").references(() => franchises.id, {
      onDelete: "set null",
    }),
    subFranchiseId: integer("sub_franchise_id").references(
      () => franchises.id,
      {
        onDelete: "set null",
      },
    ),
    notes: text("notes").notNull().default(""),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    runtime: integer("runtime"),
    director: text("director"),
    overview: text("overview"),
    tmdbGenres: jsonb("tmdb_genres").$type<string[]>(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP::text`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP::text`),
  },
  (table) => [
    check(
      "films_status_check",
      sql`${table.status} in ('watched', 'to_watch', 'to_rewatch')`,
    ),
    uniqueIndex("films_tmdb_id_unique").on(table.tmdbId),
    index("films_status_idx").on(table.status),
    index("films_last_watch_date_idx").on(table.lastWatchDate),
  ],
);

export const formVersions = pgTable(
  "form_versions",
  {
    id: serial("id").primaryKey(),
    label: text("label").notNull(),
    status: text("status", { enum: formVersionStatuses }).notNull(),
    divisorMode: text("divisor_mode", { enum: divisorModes })
      .notNull()
      .default("manual"),
    manualDivisor: real("manual_divisor"),
    secondaryDivisorMode: text("secondary_divisor_mode", {
      enum: divisorModes,
    })
      .notNull()
      .default("manual"),
    secondaryManualDivisor: real("secondary_manual_divisor"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP::text`),
    publishedAt: text("published_at"),
  },
  (table) => [
    check(
      "form_versions_status_check",
      sql`${table.status} in ('draft', 'published', 'archived')`,
    ),
    check(
      "form_versions_divisor_mode_check",
      sql`${table.divisorMode} in ('auto', 'manual')`,
    ),
    uniqueIndex("form_versions_one_published")
      .on(table.status)
      .where(sql`${table.status} = 'published'`),
    uniqueIndex("form_versions_one_draft")
      .on(table.status)
      .where(sql`${table.status} = 'draft'`),
  ],
);

export const formSections = pgTable(
  "form_sections",
  {
    id: serial("id").primaryKey(),
    formVersionId: integer("form_version_id")
      .notNull()
      .references(() => formVersions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    index("form_sections_version_order_idx").on(
      table.formVersionId,
      table.sortOrder,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    formVersionId: integer("form_version_id")
      .notNull()
      .references(() => formVersions.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    helpText: text("help_text").notNull().default(""),
    type: text("type", { enum: questionTypes }).notNull(),
    sectionId: integer("section_id").references(() => formSections.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull(),
    required: boolean("required").notNull().default(true),
    scored: boolean("scored").notNull().default(false),
    weight: real("weight"),
    secondaryScored: boolean("secondary_scored")
      .notNull()
      .default(false),
    secondaryWeight: real("secondary_weight"),
    min: real("min"),
    max: real("max"),
    offset: real("offset").notNull().default(0),
    secondaryOffset: real("secondary_offset").notNull().default(0),
    blankPolicy: text("blank_policy", { enum: blankPolicies })
      .notNull()
      .default("exclude_and_renormalize"),
    secondaryBlankPolicy: text("secondary_blank_policy", {
      enum: blankPolicies,
    })
      .notNull()
      .default("exclude_and_renormalize"),
    multiSelectScoring: text("multi_select_scoring", {
      enum: multiSelectScorings,
    }),
    allowNa: boolean("allow_na").notNull().default(false),
    conditionLogic: text("condition_logic", { enum: conditionLogics })
      .notNull()
      .default("all"),
    rcaEnabled: boolean("rca_enabled")
      .notNull()
      .default(false),
    archivedAt: text("archived_at"),
  },
  (table) => [
    uniqueIndex("questions_version_key_unique").on(
      table.formVersionId,
      table.key,
    ),
    index("questions_version_order_idx").on(
      table.formVersionId,
      table.sortOrder,
    ),
    index("questions_section_idx").on(table.sectionId),
  ],
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    valueScore: real("value_score"),
    isNull: boolean("is_null").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("question_options_question_order_idx").on(
      table.questionId,
      table.sortOrder,
    ),
  ],
);

export const questionConditions = pgTable(
  "question_conditions",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    sourceQuestionId: integer("source_question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    operator: text("operator", { enum: conditionOperators }).notNull(),
    value: jsonb("value").$type<number | number[] | null>(),
    effect: text("effect", { enum: conditionEffects }).notNull(),
  },
  (table) => [
    index("question_conditions_target_idx").on(table.questionId),
    index("question_conditions_source_idx").on(table.sourceQuestionId),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: serial("id").primaryKey(),
    filmId: integer("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    valueNumber: real("value_number"),
    valueText: text("value_text"),
    valueOptionIds: jsonb("value_option_ids").$type<
      number[]
    >(),
    isNa: boolean("is_na").notNull().default(false),
  },
  (table) => [
    uniqueIndex("answers_film_question_unique").on(
      table.filmId,
      table.questionId,
    ),
    index("answers_question_idx").on(table.questionId),
  ],
);

export const scaleLevels = pgTable("scale_levels", {
  level: integer("level").primaryKey(),
  title: text("title").notNull().default(""),
  meaning: text("meaning").notNull().default(""),
  exampleFilms: text("example_films").notNull().default(""),
});

export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    filmId: integer("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    formVersionId: integer("form_version_id")
      .notNull()
      .references(() => formVersions.id),
    overall: real("overall").notNull(),
    overallSecondary: real("overall_secondary"),
    ratedAt: text("rated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP::text`),
  },
  (table) => [
    uniqueIndex("ratings_film_id_unique").on(table.filmId),
    index("ratings_overall_idx").on(table.overall),
  ],
);

export const watchLog = pgTable(
  "watch_log",
  {
    id: serial("id").primaryKey(),
    filmId: integer("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    watchedOn: text("watched_on").notNull(),
    isRewatch: boolean("is_rewatch")
      .notNull()
      .default(false),
  },
  (table) => [
    index("watch_log_film_idx").on(table.filmId),
    index("watch_log_date_idx").on(table.watchedOn),
  ],
);

export const rcaTags = pgTable(
  "rca_tags",
  {
    id: serial("id").primaryKey(),
    label: text("label").notNull(),
    questionKey: text("question_key").notNull(),
    polarity: text("polarity", { enum: rcaPolarities }).notNull(),
    color: text("color"),
  },
  (table) => [
    check(
      "rca_tags_polarity_check",
      sql`${table.polarity} in ('positive','negative','neutral')`,
    ),
    uniqueIndex("rca_tags_label_question_key_unique").on(
      table.label,
      table.questionKey,
    ),
  ],
);

export const filmRcaTags = pgTable(
  "film_rca_tags",
  {
    filmId: integer("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    rcaTagId: integer("rca_tag_id")
      .notNull()
      .references(() => rcaTags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.filmId, table.rcaTagId] })],
);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  weights: jsonb("weights")
    .$type<Record<string, number>>()
    .notNull(),
  rubric: jsonb("rubric")
    .$type<Array<{ score: number; meaning: string; examples: string[] }>>()
    .notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

export type Film = typeof films.$inferSelect;
export type NewFilm = typeof films.$inferInsert;
