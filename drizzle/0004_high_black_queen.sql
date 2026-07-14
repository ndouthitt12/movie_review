PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`form_version_id` integer NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`help_text` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`section_id` integer,
	`sort_order` integer NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`scored` integer DEFAULT false NOT NULL,
	`weight` real,
	`secondary_scored` integer DEFAULT false NOT NULL,
	`secondary_weight` real,
	`min` real,
	`max` real,
	`offset` real DEFAULT 0 NOT NULL,
	`secondary_offset` real DEFAULT 0 NOT NULL,
	`blank_policy` text DEFAULT 'exclude_and_renormalize' NOT NULL,
	`secondary_blank_policy` text DEFAULT 'exclude_and_renormalize' NOT NULL,
	`multi_select_scoring` text,
	`allow_na` integer DEFAULT false NOT NULL,
	`condition_logic` text DEFAULT 'all' NOT NULL,
	`rca_enabled` integer DEFAULT false NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`form_version_id`) REFERENCES `form_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `form_sections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "form_version_id", "key", "label", "help_text", "type", "section_id", "sort_order", "required", "scored", "weight", "secondary_scored", "secondary_weight", "min", "max", "offset", "secondary_offset", "blank_policy", "secondary_blank_policy", "multi_select_scoring", "allow_na", "condition_logic", "rca_enabled", "archived_at") SELECT "id", "form_version_id", "key", "label", "help_text", "type", "section_id", "sort_order", "required", "scored", "weight", "secondary_scored", "secondary_weight", "min", "max", "offset", "secondary_offset", "blank_policy", "secondary_blank_policy", "multi_select_scoring", "allow_na", "condition_logic", "rca_enabled", "archived_at" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `questions_version_key_unique` ON `questions` (`form_version_id`,`key`);--> statement-breakpoint
CREATE INDEX `questions_version_order_idx` ON `questions` (`form_version_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `questions_section_idx` ON `questions` (`section_id`);