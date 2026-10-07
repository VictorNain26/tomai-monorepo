ALTER TABLE "learner_notion_reset" ALTER COLUMN "after_position" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "student_profile" DROP COLUMN "memory_reset_at";--> statement-breakpoint
ALTER TABLE "learner_notion_reset" DROP COLUMN "reset_at";