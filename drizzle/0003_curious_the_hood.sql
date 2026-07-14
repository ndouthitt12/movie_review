ALTER TABLE `form_versions` ADD `secondary_divisor_mode` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `form_versions` ADD `secondary_manual_divisor` real;--> statement-breakpoint
ALTER TABLE `questions` ADD `secondary_scored` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `secondary_weight` real;--> statement-breakpoint
ALTER TABLE `questions` ADD `secondary_offset` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `secondary_blank_policy` text DEFAULT 'exclude_and_renormalize' NOT NULL;
--> statement-breakpoint
UPDATE `form_versions`
SET `secondary_divisor_mode` = 'manual', `secondary_manual_divisor` = 100
WHERE `label` = 'v1 — spreadsheet-era form';
--> statement-breakpoint
UPDATE `questions`
SET `secondary_scored` = true,
    `secondary_weight` = CASE `key`
      WHEN 'quality' THEN 5
      WHEN 'rewatchability' THEN 4
      WHEN 'genre_fit' THEN 1
    END
WHERE `key` IN ('quality', 'rewatchability', 'genre_fit')
  AND `form_version_id` IN (
    SELECT `id` FROM `form_versions` WHERE `label` = 'v1 — spreadsheet-era form'
  );
