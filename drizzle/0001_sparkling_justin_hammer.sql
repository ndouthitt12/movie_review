CREATE TABLE `answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`film_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`value_number` real,
	`value_text` text,
	`value_option_ids` text,
	`is_na` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answers_film_question_unique` ON `answers` (`film_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `answers_question_idx` ON `answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `form_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`form_version_id` integer NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`form_version_id`) REFERENCES `form_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `form_sections_version_order_idx` ON `form_sections` (`form_version_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `form_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`divisor_mode` text DEFAULT 'manual' NOT NULL,
	`manual_divisor` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	CONSTRAINT "form_versions_status_check" CHECK("form_versions"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "form_versions_divisor_mode_check" CHECK("form_versions"."divisor_mode" in ('auto', 'manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_versions_one_published` ON `form_versions` (`status`) WHERE "form_versions"."status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX `form_versions_one_draft` ON `form_versions` (`status`) WHERE "form_versions"."status" = 'draft';--> statement-breakpoint
CREATE TABLE `question_conditions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`source_question_id` integer NOT NULL,
	`operator` text NOT NULL,
	`value` text,
	`effect` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_conditions_target_idx` ON `question_conditions` (`question_id`);--> statement-breakpoint
CREATE INDEX `question_conditions_source_idx` ON `question_conditions` (`source_question_id`);--> statement-breakpoint
CREATE TABLE `question_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`label` text NOT NULL,
	`value_score` real,
	`is_null` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_options_question_order_idx` ON `question_options` (`question_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`form_version_id` integer NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`help_text` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`section_id` integer,
	`sort_order` integer NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`scored` integer DEFAULT false NOT NULL,
	`weight` real,
	`min` real,
	`max` real,
	`offset` real DEFAULT 0 NOT NULL,
	`blank_policy` text DEFAULT 'exclude_and_renormalize' NOT NULL,
	`multi_select_scoring` text,
	`allow_na` integer DEFAULT false NOT NULL,
	`condition_logic` text DEFAULT 'all' NOT NULL,
	`rca_enabled` integer DEFAULT false NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`form_version_id`) REFERENCES `form_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `form_sections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_version_key_unique` ON `questions` (`form_version_id`,`key`);--> statement-breakpoint
CREATE INDEX `questions_version_order_idx` ON `questions` (`form_version_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `questions_section_idx` ON `questions` (`section_id`);--> statement-breakpoint
CREATE TABLE `scale_levels` (
	`level` integer PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`example_films` text DEFAULT '' NOT NULL
);
