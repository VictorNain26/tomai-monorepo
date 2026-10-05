ALTER TABLE "exercise_sheets" ADD COLUMN "hint_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_sheets" ADD COLUMN "steps_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_sheets" ADD COLUMN "hints" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_sheets" ADD COLUMN "solved_at" timestamp with time zone;