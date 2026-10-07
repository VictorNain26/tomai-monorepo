CREATE TYPE "public"."turn_outcome" AS ENUM('passed', 'regenerated', 'fallback', 'distress', 'closed');--> statement-breakpoint
CREATE TABLE "turn_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"analysis" jsonb,
	"input_flagged" jsonb,
	"exercise_id" uuid,
	"new_exercise" boolean NOT NULL,
	"hint_level" integer,
	"verdict" text,
	"decided_by" text,
	"reasoning_effort" text,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"findings" jsonb NOT NULL,
	"outcome" "turn_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_session" ADD COLUMN "turn_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "turn_record" ADD CONSTRAINT "turn_record_session_id_study_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_record" ADD CONSTRAINT "turn_record_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "turn_record_session_id_created_at_idx" ON "turn_record" USING btree ("session_id","created_at");