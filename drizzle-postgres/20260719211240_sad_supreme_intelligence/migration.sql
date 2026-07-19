ALTER TABLE "rca_tags" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "rca_tags_question_order_idx" ON "rca_tags" ("question_key","sort_order");