ALTER TABLE "cost_tracking" ALTER COLUMN "ai_model" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "ai_model" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "ai_model_used" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "ai_model_used" SET DEFAULT 'gemini-3-flash';--> statement-breakpoint
DROP TYPE "public"."ai_model";