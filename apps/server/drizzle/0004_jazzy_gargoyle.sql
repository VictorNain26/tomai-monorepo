ALTER TABLE "cost_tracking" ALTER COLUMN "ai_model" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "ai_model" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "ai_model_used" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "ai_model_used" SET DEFAULT 'gemini_3_flash'::text;--> statement-breakpoint
DROP TYPE "public"."ai_model";--> statement-breakpoint
CREATE TYPE "public"."ai_model" AS ENUM('gemini_3_flash');--> statement-breakpoint
ALTER TABLE "cost_tracking" ALTER COLUMN "ai_model" SET DATA TYPE "public"."ai_model" USING "ai_model"::"public"."ai_model";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "ai_model" SET DATA TYPE "public"."ai_model" USING "ai_model"::"public"."ai_model";--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "ai_model_used" SET DEFAULT 'gemini_3_flash'::"public"."ai_model";--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "ai_model_used" SET DATA TYPE "public"."ai_model" USING "ai_model_used"::"public"."ai_model";