ALTER TABLE "study_session" ADD COLUMN "accompanied" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "study_session" ADD COLUMN "parent_cues" integer DEFAULT 0 NOT NULL;