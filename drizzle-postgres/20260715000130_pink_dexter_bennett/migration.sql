CREATE TABLE "answers" (
	"id" serial PRIMARY KEY,
	"film_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"value_number" real,
	"value_text" text,
	"value_option_ids" jsonb,
	"is_na" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "film_rca_tags" (
	"film_id" integer,
	"rca_tag_id" integer,
	CONSTRAINT "film_rca_tags_pkey" PRIMARY KEY("film_id","rca_tag_id")
);
--> statement-breakpoint
CREATE TABLE "films" (
	"id" serial PRIMARY KEY,
	"tmdb_id" integer,
	"title" text NOT NULL,
	"release_year" integer NOT NULL,
	"status" text NOT NULL,
	"watch_order" integer,
	"last_watch_date" text,
	"genre_primary" text,
	"genre_secondary" text,
	"franchise_id" integer,
	"sub_franchise_id" integer,
	"notes" text DEFAULT '' NOT NULL,
	"poster_path" text,
	"backdrop_path" text,
	"runtime" integer,
	"director" text,
	"overview" text,
	"tmdb_genres" jsonb,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "films_status_check" CHECK ("status" in ('watched', 'to_watch', 'to_rewatch'))
);
--> statement-breakpoint
CREATE TABLE "form_sections" (
	"id" serial PRIMARY KEY,
	"form_version_id" integer NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_versions" (
	"id" serial PRIMARY KEY,
	"label" text NOT NULL,
	"status" text NOT NULL,
	"divisor_mode" text DEFAULT 'manual' NOT NULL,
	"manual_divisor" real,
	"secondary_divisor_mode" text DEFAULT 'manual' NOT NULL,
	"secondary_manual_divisor" real,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"published_at" text,
	CONSTRAINT "form_versions_status_check" CHECK ("status" in ('draft', 'published', 'archived')),
	CONSTRAINT "form_versions_divisor_mode_check" CHECK ("divisor_mode" in ('auto', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "franchises" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "question_conditions" (
	"id" serial PRIMARY KEY,
	"question_id" integer NOT NULL,
	"source_question_id" integer NOT NULL,
	"operator" text NOT NULL,
	"value" jsonb,
	"effect" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" serial PRIMARY KEY,
	"question_id" integer NOT NULL,
	"label" text NOT NULL,
	"value_score" real,
	"is_null" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" text
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY,
	"form_version_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"help_text" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"section_id" integer,
	"sort_order" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"scored" boolean DEFAULT false NOT NULL,
	"weight" real,
	"secondary_scored" boolean DEFAULT false NOT NULL,
	"secondary_weight" real,
	"min" real,
	"max" real,
	"offset" real DEFAULT 0 NOT NULL,
	"secondary_offset" real DEFAULT 0 NOT NULL,
	"blank_policy" text DEFAULT 'exclude_and_renormalize' NOT NULL,
	"secondary_blank_policy" text DEFAULT 'exclude_and_renormalize' NOT NULL,
	"multi_select_scoring" text,
	"allow_na" boolean DEFAULT false NOT NULL,
	"condition_logic" text DEFAULT 'all' NOT NULL,
	"rca_enabled" boolean DEFAULT false NOT NULL,
	"archived_at" text
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY,
	"film_id" integer NOT NULL,
	"form_version_id" integer NOT NULL,
	"overall" real NOT NULL,
	"overall_secondary" real,
	"rated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rca_tags" (
	"id" serial PRIMARY KEY,
	"label" text NOT NULL,
	"question_key" text NOT NULL,
	"polarity" text NOT NULL,
	"color" text,
	CONSTRAINT "rca_tags_polarity_check" CHECK ("polarity" in ('positive','negative','neutral'))
);
--> statement-breakpoint
CREATE TABLE "scale_levels" (
	"level" integer PRIMARY KEY,
	"title" text DEFAULT '' NOT NULL,
	"meaning" text DEFAULT '' NOT NULL,
	"example_films" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY,
	"weights" jsonb NOT NULL,
	"rubric" jsonb NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_log" (
	"id" serial PRIMARY KEY,
	"film_id" integer NOT NULL,
	"watched_on" text NOT NULL,
	"is_rewatch" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "answers_film_question_unique" ON "answers" ("film_id","question_id");--> statement-breakpoint
CREATE INDEX "answers_question_idx" ON "answers" ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "films_tmdb_id_unique" ON "films" ("tmdb_id");--> statement-breakpoint
CREATE INDEX "films_status_idx" ON "films" ("status");--> statement-breakpoint
CREATE INDEX "films_last_watch_date_idx" ON "films" ("last_watch_date");--> statement-breakpoint
CREATE INDEX "form_sections_version_order_idx" ON "form_sections" ("form_version_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "form_versions_one_published" ON "form_versions" ("status") WHERE "status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX "form_versions_one_draft" ON "form_versions" ("status") WHERE "status" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "franchises_name_parent_unique" ON "franchises" ("name","parent_id");--> statement-breakpoint
CREATE INDEX "franchises_parent_idx" ON "franchises" ("parent_id");--> statement-breakpoint
CREATE INDEX "question_conditions_target_idx" ON "question_conditions" ("question_id");--> statement-breakpoint
CREATE INDEX "question_conditions_source_idx" ON "question_conditions" ("source_question_id");--> statement-breakpoint
CREATE INDEX "question_options_question_order_idx" ON "question_options" ("question_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_version_key_unique" ON "questions" ("form_version_id","key");--> statement-breakpoint
CREATE INDEX "questions_version_order_idx" ON "questions" ("form_version_id","sort_order");--> statement-breakpoint
CREATE INDEX "questions_section_idx" ON "questions" ("section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_film_id_unique" ON "ratings" ("film_id");--> statement-breakpoint
CREATE INDEX "ratings_overall_idx" ON "ratings" ("overall");--> statement-breakpoint
CREATE UNIQUE INDEX "rca_tags_label_question_key_unique" ON "rca_tags" ("label","question_key");--> statement-breakpoint
CREATE INDEX "watch_log_film_idx" ON "watch_log" ("film_id");--> statement-breakpoint
CREATE INDEX "watch_log_date_idx" ON "watch_log" ("watched_on");--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_film_id_films_id_fkey" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "film_rca_tags" ADD CONSTRAINT "film_rca_tags_film_id_films_id_fkey" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "film_rca_tags" ADD CONSTRAINT "film_rca_tags_rca_tag_id_rca_tags_id_fkey" FOREIGN KEY ("rca_tag_id") REFERENCES "rca_tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_franchise_id_franchises_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_sub_franchise_id_franchises_id_fkey" FOREIGN KEY ("sub_franchise_id") REFERENCES "franchises"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "form_sections" ADD CONSTRAINT "form_sections_form_version_id_form_versions_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_parent_id_franchises_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "franchises"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "question_conditions" ADD CONSTRAINT "question_conditions_question_id_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "question_conditions" ADD CONSTRAINT "question_conditions_source_question_id_questions_id_fkey" FOREIGN KEY ("source_question_id") REFERENCES "questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_form_version_id_form_versions_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_section_id_form_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "form_sections"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_film_id_films_id_fkey" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_form_version_id_form_versions_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id");--> statement-breakpoint
ALTER TABLE "watch_log" ADD CONSTRAINT "watch_log_film_id_films_id_fkey" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE CASCADE;