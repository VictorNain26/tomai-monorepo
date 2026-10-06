ALTER TABLE "parent_restore_token" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "progress" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "parent_restore_token" CASCADE;--> statement-breakpoint
DROP TABLE "progress" CASCADE;--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_impersonated_by_fkey";
--> statement-breakpoint
DROP INDEX "idx_messages_quality";--> statement-breakpoint
DROP INDEX "idx_session_impersonated_by";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "storage_bucket";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "storage_region";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "content_hash";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "frustration_level";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "question_level";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "socratic_level";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "message_category";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "message_quality_score";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "is_helpful";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "contains_pii";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "is_flagged";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "impersonated_by";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "duration_minutes";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "frustration_avg";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "frustration_min";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "frustration_max";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "question_levels_avg";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "concepts_covered";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "socratic_effectiveness";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "student_engagement";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "questions_asked";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "questions_answered";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "hints_given";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "ai_model_used";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "total_tokens_used";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "api_cost_cents";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "average_response_time_ms";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "device_type";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "user_satisfaction";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "session_rating";--> statement-breakpoint
ALTER TABLE "study_sessions" DROP COLUMN "session_metadata";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "login_count";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "preferences";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "banned";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ban_reason";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ban_expires";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "country_code";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "timezone";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "last_login_at";