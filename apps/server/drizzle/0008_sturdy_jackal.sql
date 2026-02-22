ALTER TABLE "study_sessions" ADD COLUMN "conversation_summary" text;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "summary_up_to_message_id" uuid;