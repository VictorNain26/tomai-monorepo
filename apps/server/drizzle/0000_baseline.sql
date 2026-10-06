CREATE TYPE "public"."billing_status" AS ENUM('active', 'past_due', 'canceled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."card_type" AS ENUM('concept', 'flashcard', 'qcm', 'vrai_faux', 'matching', 'fill_blank', 'word_order', 'calculation', 'timeline', 'matching_era', 'cause_effect', 'classification', 'process_order', 'grammar_transform', 'reformulation');--> statement-breakpoint
CREATE TYPE "public"."deck_source" AS ENUM('prompt', 'conversation', 'document');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'uploaded', 'processing', 'ready', 'expired', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."school_level" AS ENUM('sixieme', 'cinquieme', 'quatrieme', 'troisieme');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('draft', 'active', 'paused', 'completed', 'abandoned', 'timeout', 'error');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan_type" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'parent');--> statement-breakpoint
CREATE TABLE "account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" varchar(255),
	"password" varchar(255),
	"salt" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255),
	"session_id" uuid,
	"ai_model" text NOT NULL,
	"operation" varchar(50) DEFAULT 'chat' NOT NULL,
	"tokens_input" integer DEFAULT 0 NOT NULL,
	"tokens_output" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"billing_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distress_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" uuid NOT NULL,
	"detected_by" varchar(16) NOT NULL,
	"selfharm_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sheet" jsonb,
	"uncertain" boolean NOT NULL,
	"math_check" varchar(16) NOT NULL,
	"prompt_version" varchar(32) NOT NULL,
	"hint_level" integer DEFAULT 0 NOT NULL,
	"steps_done" integer DEFAULT 0 NOT NULL,
	"hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"solved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" varchar(255) NOT NULL,
	"revenuecat_customer_id" varchar(255),
	"revenuecat_subscription_id" varchar(255),
	"billing_status" "billing_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"monthly_amount_cents" integer DEFAULT 0 NOT NULL,
	"last_payment_amount_cents" integer,
	"last_payment_at" timestamp with time zone,
	"premium_children_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_billing_parent_id_unique" UNIQUE("parent_id")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"educational_context" jsonb DEFAULT '{}'::jsonb,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"card_type" "card_type" NOT NULL,
	"content" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"fsrs_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"subject" varchar(100) NOT NULL,
	"source" "deck_source" NOT NULL,
	"source_id" varchar(255),
	"source_prompt" text,
	"school_level" "school_level",
	"card_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"ai_model" text,
	"tokens_used" integer DEFAULT 0,
	"attached_file" jsonb,
	"message_metadata" jsonb DEFAULT '{}'::jsonb,
	"model_messages" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_child" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_user_id" varchar(255) NOT NULL,
	"child_user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_child_pair_unique" UNIQUE("parent_user_id","child_user_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "session_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"attached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_files_session_file_unique" UNIQUE("session_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"subject" varchar(100) DEFAULT 'general' NOT NULL,
	"topic" varchar(200),
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"conversation_summary" text,
	"summary_up_to_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"type" "subscription_plan_type" NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"daily_token_limit" integer NOT NULL,
	"reset_interval_hours" integer DEFAULT 24 NOT NULL,
	"price_first_child_cents" integer DEFAULT 0 NOT NULL,
	"price_additional_child_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(320),
	"email_verified" boolean DEFAULT false,
	"image" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" varchar(50),
	"display_username" varchar(50),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"role" "user_role" DEFAULT 'parent' NOT NULL,
	"school_level" "school_level",
	"date_of_birth" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username"),
	CONSTRAINT "user_display_username_unique" UNIQUE("display_username")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"window_tokens_used" integer DEFAULT 0 NOT NULL,
	"window_start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tokens_used_today" integer DEFAULT 0 NOT NULL,
	"decks_generated_today" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decks_generated_this_month" integer DEFAULT 0 NOT NULL,
	"last_monthly_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tokens_used_this_week" integer DEFAULT 0 NOT NULL,
	"last_weekly_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_tokens_used" integer DEFAULT 0 NOT NULL,
	"total_messages_count" integer DEFAULT 0 NOT NULL,
	"total_days_active" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracking" ADD CONSTRAINT "cost_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracking" ADD CONSTRAINT "cost_tracking_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distress_events" ADD CONSTRAINT "distress_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distress_events" ADD CONSTRAINT "distress_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sheets" ADD CONSTRAINT "exercise_sheets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_billing" ADD CONSTRAINT "family_billing_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_cards" ADD CONSTRAINT "learning_cards_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."learning_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_decks" ADD CONSTRAINT "learning_decks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_child_user_id_fkey" FOREIGN KEY ("child_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_files" ADD CONSTRAINT "session_files_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_files" ADD CONSTRAINT "session_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_user_id" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_account_provider_account" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_cost_tracking_user_id" ON "cost_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cost_tracking_created_at" ON "cost_tracking" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_distress_events_session" ON "distress_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_distress_events_user_created" ON "distress_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_exercise_sheets_session_created" ON "exercise_sheets" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_family_billing_revenuecat_customer" ON "family_billing" USING btree ("revenuecat_customer_id");--> statement-breakpoint
CREATE INDEX "idx_family_billing_status" ON "family_billing" USING btree ("billing_status");--> statement-breakpoint
CREATE INDEX "idx_files_user_id" ON "files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_files_status" ON "files" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_files_storage_key" ON "files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "idx_files_created_at" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_learning_cards_deck_position" ON "learning_cards" USING btree ("deck_id","position");--> statement-breakpoint
CREATE INDEX "idx_learning_cards_type" ON "learning_cards" USING btree ("card_type");--> statement-breakpoint
CREATE INDEX "idx_learning_decks_user_subject" ON "learning_decks" USING btree ("user_id","subject");--> statement-breakpoint
CREATE INDEX "idx_learning_decks_user_created" ON "learning_decks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_session_created" ON "messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_parent_child_parent" ON "parent_child" USING btree ("parent_user_id");--> statement-breakpoint
CREATE INDEX "idx_parent_child_child" ON "parent_child" USING btree ("child_user_id");--> statement-breakpoint
CREATE INDEX "idx_session_token" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_session_user_id" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_expires_at" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_session_files_session" ON "session_files" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_session_files_file" ON "session_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_status" ON "study_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_subject_date" ON "study_sessions" USING btree ("user_id","subject","started_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_active" ON "study_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_user_email" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_user_username" ON "user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_user_role" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_user_school_level" ON "user" USING btree ("school_level");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_last_reset" ON "user_subscriptions" USING btree ("last_reset_at");--> statement-breakpoint
CREATE INDEX "idx_verification_identifier" ON "verification" USING btree ("identifier");