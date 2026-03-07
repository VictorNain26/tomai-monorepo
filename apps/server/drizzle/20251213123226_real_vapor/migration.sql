CREATE TYPE "public"."ai_model" AS ENUM('gemini_2_5_flash');--> statement-breakpoint
CREATE TYPE "public"."card_type" AS ENUM('flashcard', 'qcm', 'vrai_faux', 'matching', 'fill_blank', 'word_order', 'calculation', 'timeline', 'matching_era', 'cause_effect', 'classification', 'process_order', 'grammar_transform');--> statement-breakpoint
CREATE TYPE "public"."deck_source" AS ENUM('prompt', 'conversation', 'document', 'rag_program');--> statement-breakpoint
CREATE TYPE "public"."establishment_status" AS ENUM('ouvert', 'ferme', 'a_ouvrir');--> statement-breakpoint
CREATE TYPE "public"."establishment_type" AS ENUM('college', 'lycee', 'lycee_general_technologique', 'lycee_professionnel', 'lycee_polyvalent', 'lycee_agricole', 'etablissement_regional_enseignement_adapte', 'cite_scolaire', 'autre');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."school_level" AS ENUM('cp', 'ce1', 'ce2', 'cm1', 'cm2', 'sixieme', 'cinquieme', 'quatrieme', 'troisieme', 'seconde', 'premiere', 'terminale');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('draft', 'active', 'paused', 'completed', 'abandoned', 'timeout', 'error');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan_type" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'parent', 'admin');--> statement-breakpoint
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
	"ai_model" "ai_model" NOT NULL,
	"operation" varchar(50) DEFAULT 'chat' NOT NULL,
	"tokens_input" integer DEFAULT 0 NOT NULL,
	"tokens_output" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"billing_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "establishments" (
	"rne" varchar(8) PRIMARY KEY NOT NULL,
	"name" varchar(300) NOT NULL,
	"normalized_name" varchar(300) NOT NULL,
	"type" "establishment_type" NOT NULL,
	"status" "establishment_status" DEFAULT 'ouvert' NOT NULL,
	"address1" varchar(200),
	"address2" varchar(200),
	"address3" varchar(200),
	"full_address" varchar(600) NOT NULL,
	"city" varchar(100) NOT NULL,
	"postal_code" varchar(5) NOT NULL,
	"department" varchar(100) NOT NULL,
	"department_code" varchar(3) NOT NULL,
	"academy" varchar(100) NOT NULL,
	"latitude" real,
	"longitude" real,
	"public_private" varchar(20),
	"ministerial_code" varchar(20),
	"siret" varchar(14),
	"pronote_url" varchar(400) NOT NULL,
	"has_pronote" boolean DEFAULT true NOT NULL,
	"pronote_checked_at" timestamp with time zone,
	"voie_generale" boolean DEFAULT false,
	"voie_technologique" boolean DEFAULT false,
	"voie_professionnelle" boolean DEFAULT false,
	"search_terms" text NOT NULL,
	"data_quality" integer DEFAULT 100,
	"is_validated" boolean DEFAULT false,
	"validated_at" timestamp with time zone,
	"validated_by" varchar(255),
	"source_api" varchar(50) DEFAULT 'education_nationale' NOT NULL,
	"last_sync_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"data_hash" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"sync_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"billing_status" varchar(50) DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"monthly_amount_cents" integer DEFAULT 0 NOT NULL,
	"last_payment_amount_cents" integer,
	"last_payment_at" timestamp with time zone,
	"premium_children_count" integer DEFAULT 0 NOT NULL,
	"stripe_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_billing_parent_id_unique" UNIQUE("parent_id"),
	CONSTRAINT "family_billing_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "family_billing_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
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
	"content_hash" varchar(64),
	"frustration_level" integer,
	"question_level" integer,
	"socratic_level" integer,
	"message_category" varchar(50),
	"ai_model" "ai_model",
	"tokens_used" integer DEFAULT 0,
	"response_time_ms" integer,
	"message_quality_score" numeric(3, 2),
	"is_helpful" boolean,
	"contains_pii" boolean DEFAULT false,
	"is_flagged" boolean DEFAULT false,
	"attached_file" jsonb,
	"message_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"concept" varchar(200) NOT NULL,
	"competency_domain" varchar(10),
	"mastery_level" integer NOT NULL,
	"total_practice_time" integer DEFAULT 0 NOT NULL,
	"success_rate" numeric(5, 2),
	"progress_history" jsonb DEFAULT '[]'::jsonb,
	"first_practiced" timestamp with time zone DEFAULT now() NOT NULL,
	"last_practiced" timestamp with time zone DEFAULT now() NOT NULL,
	"progress_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_user_id_subject_concept_key" UNIQUE("user_id","subject","concept")
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
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"topic" varchar(200),
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_minutes" integer,
	"frustration_avg" numeric(3, 2) DEFAULT '0',
	"frustration_min" numeric(3, 2) DEFAULT '0',
	"frustration_max" numeric(3, 2) DEFAULT '0',
	"question_levels_avg" numeric(3, 2) DEFAULT '0',
	"concepts_covered" text[] DEFAULT '{}'::text[],
	"socratic_effectiveness" numeric(3, 2) DEFAULT '0',
	"student_engagement" numeric(3, 2) DEFAULT '0',
	"questions_asked" integer DEFAULT 0,
	"questions_answered" integer DEFAULT 0,
	"hints_given" integer DEFAULT 0,
	"ai_model_used" "ai_model" DEFAULT 'gemini_2_5_flash' NOT NULL,
	"total_tokens_used" integer DEFAULT 0,
	"api_cost_cents" integer DEFAULT 0,
	"average_response_time_ms" integer,
	"device_type" varchar(20),
	"user_satisfaction" integer,
	"session_rating" integer,
	"session_metadata" jsonb DEFAULT '{}'::jsonb,
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
	"stripe_product_id" varchar(255),
	"stripe_price_id_first_child" varchar(255),
	"stripe_price_id_additional_child" varchar(255),
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
	"selected_lv2" varchar(50),
	"date_of_birth" varchar(10),
	"parent_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"login_count" integer DEFAULT 0,
	"preferences" jsonb DEFAULT '{"theme": "light", "language": "fr", "notifications": true, "adaptive_difficulty": true}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"subscription_status" varchar(50) DEFAULT 'inactive',
	"subscription_plan" varchar(50) DEFAULT 'free',
	"country_code" varchar(2) DEFAULT 'FR',
	"timezone" varchar(50) DEFAULT 'Europe/Paris',
	"last_login_at" timestamp with time zone,
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
	"value" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracking" ADD CONSTRAINT "cost_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracking" ADD CONSTRAINT "cost_tracking_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_billing" ADD CONSTRAINT "family_billing_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_cards" ADD CONSTRAINT "learning_cards_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."learning_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_decks" ADD CONSTRAINT "learning_decks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_user_id" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_account_provider_account" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_cost_tracking_user_id" ON "cost_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cost_tracking_created_at" ON "cost_tracking" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_establishments_location" ON "establishments" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "idx_establishments_city" ON "establishments" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_establishments_postal_code" ON "establishments" USING btree ("postal_code");--> statement-breakpoint
CREATE INDEX "idx_establishments_department" ON "establishments" USING btree ("department_code");--> statement-breakpoint
CREATE INDEX "idx_establishments_academy" ON "establishments" USING btree ("academy");--> statement-breakpoint
CREATE INDEX "idx_establishments_type_status" ON "establishments" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "idx_establishments_name" ON "establishments" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "idx_establishments_has_pronote" ON "establishments" USING btree ("has_pronote");--> statement-breakpoint
CREATE INDEX "idx_establishments_last_sync" ON "establishments" USING btree ("last_sync_at");--> statement-breakpoint
CREATE INDEX "idx_establishments_data_quality" ON "establishments" USING btree ("data_quality");--> statement-breakpoint
CREATE INDEX "idx_establishments_is_validated" ON "establishments" USING btree ("is_validated");--> statement-breakpoint
CREATE INDEX "idx_establishments_search_composite" ON "establishments" USING btree ("type","status","has_pronote");--> statement-breakpoint
CREATE INDEX "idx_establishments_location_composite" ON "establishments" USING btree ("department_code","city","type");--> statement-breakpoint
CREATE INDEX "idx_family_billing_stripe_customer" ON "family_billing" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_family_billing_stripe_subscription" ON "family_billing" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_family_billing_status" ON "family_billing" USING btree ("billing_status");--> statement-breakpoint
CREATE INDEX "idx_learning_cards_deck_position" ON "learning_cards" USING btree ("deck_id","position");--> statement-breakpoint
CREATE INDEX "idx_learning_cards_type" ON "learning_cards" USING btree ("card_type");--> statement-breakpoint
CREATE INDEX "idx_learning_decks_user_subject" ON "learning_decks" USING btree ("user_id","subject");--> statement-breakpoint
CREATE INDEX "idx_learning_decks_user_created" ON "learning_decks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_session_created" ON "messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_quality" ON "messages" USING btree ("message_quality_score");--> statement-breakpoint
CREATE INDEX "idx_progress_user_id" ON "progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_progress_subject" ON "progress" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "idx_progress_mastery_level" ON "progress" USING btree ("mastery_level");--> statement-breakpoint
CREATE INDEX "idx_session_token" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_session_user_id" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_expires_at" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_status" ON "study_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_subject_date" ON "study_sessions" USING btree ("user_id","subject","started_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_active" ON "study_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_user_email" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_user_username" ON "user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_user_parent_id" ON "user" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_user_role" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_user_school_level" ON "user" USING btree ("school_level");--> statement-breakpoint
CREATE INDEX "idx_user_stripe_customer_id" ON "user" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_last_reset" ON "user_subscriptions" USING btree ("last_reset_at");--> statement-breakpoint
CREATE INDEX "idx_verification_identifier" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_verification_value" ON "verification" USING btree ("value");