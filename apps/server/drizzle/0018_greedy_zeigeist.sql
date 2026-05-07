ALTER TABLE "files" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."file_status";--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'uploaded', 'processing', 'ready', 'deleted');--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."file_status";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "status" SET DATA TYPE "public"."file_status" USING "status"::"public"."file_status";--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "ai_model_used" SET DEFAULT 'mistral-small-latest';--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "gemini_file_uri";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "gemini_expires_at";