CREATE TABLE "exercise_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sheet" jsonb NOT NULL,
	"uncertain" boolean NOT NULL,
	"math_check" varchar(16) NOT NULL,
	"prompt_version" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_sheets" ADD CONSTRAINT "exercise_sheets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exercise_sheets_session_created" ON "exercise_sheets" USING btree ("session_id","created_at");