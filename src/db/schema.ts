import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

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

export const franchises = sqliteTable(
  "franchises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    parentId: integer("parent_id").references(
      (): AnySQLiteColumn => franchises.id,
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

export const films = sqliteTable(
  "films",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    tmdbGenres: text("tmdb_genres", { mode: "json" }).$type<string[]>(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
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

export const ratings = sqliteTable(
  "ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filmId: integer("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    story: integer("story").notNull(),
    direction: integer("direction").notNull(),
    writing: integer("writing").notNull(),
    acting: integer("acting").notNull(),
    music: integer("music").notNull(),
    impact: integer("impact").notNull(),
    rewatchability: integer("rewatchability").notNull(),
    genreFit: integer("genre_fit").notNull(),
    quality: integer("quality"),
    overall: real("overall").notNull(),
    overallSecondary: real("overall_secondary"),
    ratedAt: text("rated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("ratings_film_id_unique").on(table.filmId),
    index("ratings_overall_idx").on(table.overall),
    ...[
      table.story,
      table.direction,
      table.writing,
      table.acting,
      table.music,
      table.impact,
      table.rewatchability,
      table.genreFit,
      table.quality,
    ].map((column, position) =>
      check(
        `ratings_score_${position}_check`,
        sql`${column} is null or ${column} between 0 and 100`,
      ),
    ),
  ],
);

export const watchLog = sqliteTable(
  "watch_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filmId: integer("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    watchedOn: text("watched_on").notNull(),
    isRewatch: integer("is_rewatch", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    index("watch_log_film_idx").on(table.filmId),
    index("watch_log_date_idx").on(table.watchedOn),
  ],
);

export const rcaTags = sqliteTable(
  "rca_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    label: text("label").notNull(),
    attribute: text("attribute", { enum: rcaAttributes }).notNull(),
    polarity: text("polarity", { enum: rcaPolarities }).notNull(),
    color: text("color"),
  },
  (table) => [
    check(
      "rca_tags_attribute_check",
      sql`${table.attribute} in ('story','direction','writing','acting','music','impact','rewatchability','genre_fit','overall')`,
    ),
    check(
      "rca_tags_polarity_check",
      sql`${table.polarity} in ('positive','negative','neutral')`,
    ),
    uniqueIndex("rca_tags_label_attribute_unique").on(
      table.label,
      table.attribute,
    ),
  ],
);

export const filmRcaTags = sqliteTable(
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

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  weights: text("weights", { mode: "json" })
    .$type<Record<string, number>>()
    .notNull(),
  rubric: text("rubric", { mode: "json" })
    .$type<Array<{ score: number; meaning: string; examples: string[] }>>()
    .notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Film = typeof films.$inferSelect;
export type NewFilm = typeof films.$inferInsert;
