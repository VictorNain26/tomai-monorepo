-- Migration 0006: Quick Switch + pronote refactor
-- Made idempotent for safe re-runs

-- file_status enum already created in 0005_files_table.sql

-- Create device_push_tokens table
CREATE TABLE IF NOT EXISTS "device_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"platform" varchar(10) NOT NULL,
	"device_name" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_push_tokens_token_unique" UNIQUE("token")
);

-- files table already created in 0005_files_table.sql

-- Create parent_restore_token table
CREATE TABLE IF NOT EXISTS "parent_restore_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"parent_id" varchar(255) NOT NULL,
	"child_id" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_restore_token_token_unique" UNIQUE("token")
);

-- Create pronote_child_mappings table
CREATE TABLE IF NOT EXISTS "pronote_child_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"child_id" varchar(255) NOT NULL,
	"resource_index" integer NOT NULL,
	"pronote_child_name" varchar(200) NOT NULL,
	"pronote_class_name" varchar(100),
	"last_homework_sync" timestamp with time zone,
	"last_grades_sync" timestamp with time zone,
	"last_timetable_sync" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pronote_child_mappings_connection_child_unique" UNIQUE("connection_id","child_id")
);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);

-- Drop establishments table if exists (idempotent)
DROP TABLE IF EXISTS "establishments" CASCADE;

-- Alter pronote_connections (drop old constraints if exist)
DO $$ BEGIN
    ALTER TABLE "pronote_connections" DROP CONSTRAINT IF EXISTS "pronote_connections_user_id_unique";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_connections" DROP CONSTRAINT IF EXISTS "pronote_connections_user_id_fkey";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_connections" DROP CONSTRAINT IF EXISTS "pronote_connections_establishment_rne_fkey";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP INDEX IF EXISTS "idx_pronote_connections_establishment";

-- Alter pronote_connections default
DO $$ BEGIN
    ALTER TABLE "pronote_connections" ALTER COLUMN "account_kind" SET DEFAULT 7;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add columns to family_billing (if not exist)
DO $$ BEGIN
    ALTER TABLE "family_billing" ADD COLUMN "revenuecat_customer_id" varchar(255);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "family_billing" ADD COLUMN "revenuecat_subscription_id" varchar(255);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Add columns to pronote_connections (if not exist)
DO $$ BEGIN
    ALTER TABLE "pronote_connections" ADD COLUMN "parent_id" varchar(255);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_connections" ADD COLUMN "establishment_name" varchar(300);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_connections" ADD COLUMN "pronote_resources" jsonb DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Add foreign keys (idempotent)
DO $$ BEGIN
    ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "parent_restore_token" ADD CONSTRAINT "parent_restore_token_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "parent_restore_token" ADD CONSTRAINT "parent_restore_token_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_child_mappings" ADD CONSTRAINT "pronote_child_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."pronote_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_child_mappings" ADD CONSTRAINT "pronote_child_mappings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS "idx_device_push_tokens_user_id" ON "device_push_tokens" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_device_push_tokens_token" ON "device_push_tokens" USING btree ("token");
CREATE INDEX IF NOT EXISTS "idx_device_push_tokens_active" ON "device_push_tokens" USING btree ("is_active");
CREATE INDEX IF NOT EXISTS "idx_files_user_id" ON "files" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_files_status" ON "files" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_files_storage_key" ON "files" USING btree ("storage_key");
CREATE INDEX IF NOT EXISTS "idx_files_created_at" ON "files" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "idx_parent_restore_token_token" ON "parent_restore_token" USING btree ("token");
CREATE INDEX IF NOT EXISTS "idx_parent_restore_token_parent_id" ON "parent_restore_token" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_parent_restore_token_expires_at" ON "parent_restore_token" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "idx_pronote_child_mappings_connection" ON "pronote_child_mappings" USING btree ("connection_id");
CREATE INDEX IF NOT EXISTS "idx_pronote_child_mappings_child" ON "pronote_child_mappings" USING btree ("child_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_event_id" ON "webhook_events" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_source" ON "webhook_events" USING btree ("source");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_expires_at" ON "webhook_events" USING btree ("expires_at");

-- Add pronote_connections foreign key
DO $$ BEGIN
    ALTER TABLE "pronote_connections" ADD CONSTRAINT "pronote_connections_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create family_billing index
CREATE INDEX IF NOT EXISTS "idx_family_billing_revenuecat_customer" ON "family_billing" USING btree ("revenuecat_customer_id");

-- Drop old columns from pronote_connections (if exist)
DO $$ BEGIN
    ALTER TABLE "pronote_connections" DROP COLUMN IF EXISTS "user_id";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_connections" DROP COLUMN IF EXISTS "establishment_rne";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_connections" DROP COLUMN IF EXISTS "last_homework_sync";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_connections" DROP COLUMN IF EXISTS "last_grades_sync";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pronote_connections" DROP COLUMN IF EXISTS "last_timetable_sync";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add unique constraint
DO $$ BEGIN
    ALTER TABLE "pronote_connections" ADD CONSTRAINT "pronote_connections_parent_id_unique" UNIQUE("parent_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drop old types (if exist)
DROP TYPE IF EXISTS "public"."establishment_status";
DROP TYPE IF EXISTS "public"."establishment_type";
