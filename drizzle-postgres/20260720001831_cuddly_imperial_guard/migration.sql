ALTER TABLE "questions" ADD COLUMN "scale_min_label" text DEFAULT 'Poor' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "scale_max_label" text DEFAULT 'Masterpiece' NOT NULL;