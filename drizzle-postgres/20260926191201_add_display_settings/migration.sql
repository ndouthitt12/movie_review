CREATE TABLE "display_settings" (
	"id" integer PRIMARY KEY,
	"score_scale" integer DEFAULT 5 NOT NULL,
	CONSTRAINT "display_settings_score_scale_check" CHECK ("score_scale" in (5, 10))
);
