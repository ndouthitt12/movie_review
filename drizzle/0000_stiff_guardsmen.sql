CREATE TABLE `film_rca_tags` (
	`film_id` integer NOT NULL,
	`rca_tag_id` integer NOT NULL,
	PRIMARY KEY(`film_id`, `rca_tag_id`),
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rca_tag_id`) REFERENCES `rca_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `films` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tmdb_id` integer,
	`title` text NOT NULL,
	`release_year` integer NOT NULL,
	`status` text NOT NULL,
	`watch_order` integer,
	`last_watch_date` text,
	`genre_primary` text,
	`genre_secondary` text,
	`franchise_id` integer,
	`sub_franchise_id` integer,
	`notes` text DEFAULT '' NOT NULL,
	`poster_path` text,
	`backdrop_path` text,
	`runtime` integer,
	`director` text,
	`overview` text,
	`tmdb_genres` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`franchise_id`) REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sub_franchise_id`) REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "films_status_check" CHECK("films"."status" in ('watched', 'to_watch', 'to_rewatch'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `films_tmdb_id_unique` ON `films` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `films_status_idx` ON `films` (`status`);--> statement-breakpoint
CREATE INDEX `films_last_watch_date_idx` ON `films` (`last_watch_date`);--> statement-breakpoint
CREATE TABLE `franchises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `franchises_name_parent_unique` ON `franchises` (`name`,`parent_id`);--> statement-breakpoint
CREATE INDEX `franchises_parent_idx` ON `franchises` (`parent_id`);--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`film_id` integer NOT NULL,
	`story` integer NOT NULL,
	`direction` integer NOT NULL,
	`writing` integer NOT NULL,
	`acting` integer NOT NULL,
	`music` integer NOT NULL,
	`impact` integer NOT NULL,
	`rewatchability` integer NOT NULL,
	`genre_fit` integer NOT NULL,
	`quality` integer,
	`overall` real NOT NULL,
	`overall_secondary` real,
	`rated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ratings_score_0_check" CHECK("ratings"."story" is null or "ratings"."story" between 0 and 100),
	CONSTRAINT "ratings_score_1_check" CHECK("ratings"."direction" is null or "ratings"."direction" between 0 and 100),
	CONSTRAINT "ratings_score_2_check" CHECK("ratings"."writing" is null or "ratings"."writing" between 0 and 100),
	CONSTRAINT "ratings_score_3_check" CHECK("ratings"."acting" is null or "ratings"."acting" between 0 and 100),
	CONSTRAINT "ratings_score_4_check" CHECK("ratings"."music" is null or "ratings"."music" between 0 and 100),
	CONSTRAINT "ratings_score_5_check" CHECK("ratings"."impact" is null or "ratings"."impact" between 0 and 100),
	CONSTRAINT "ratings_score_6_check" CHECK("ratings"."rewatchability" is null or "ratings"."rewatchability" between 0 and 100),
	CONSTRAINT "ratings_score_7_check" CHECK("ratings"."genre_fit" is null or "ratings"."genre_fit" between 0 and 100),
	CONSTRAINT "ratings_score_8_check" CHECK("ratings"."quality" is null or "ratings"."quality" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ratings_film_id_unique` ON `ratings` (`film_id`);--> statement-breakpoint
CREATE INDEX `ratings_overall_idx` ON `ratings` (`overall`);--> statement-breakpoint
CREATE TABLE `rca_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`attribute` text NOT NULL,
	`polarity` text NOT NULL,
	`color` text,
	CONSTRAINT "rca_tags_attribute_check" CHECK("rca_tags"."attribute" in ('story','direction','writing','acting','music','impact','rewatchability','genre_fit','overall')),
	CONSTRAINT "rca_tags_polarity_check" CHECK("rca_tags"."polarity" in ('positive','negative','neutral'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rca_tags_label_attribute_unique` ON `rca_tags` (`label`,`attribute`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`weights` text NOT NULL,
	`rubric` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watch_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`film_id` integer NOT NULL,
	`watched_on` text NOT NULL,
	`is_rewatch` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watch_log_film_idx` ON `watch_log` (`film_id`);--> statement-breakpoint
CREATE INDEX `watch_log_date_idx` ON `watch_log` (`watched_on`);