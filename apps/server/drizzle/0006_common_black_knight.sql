CREATE TYPE "public"."file_status" AS ENUM('pending', 'uploaded', 'processing', 'ready', 'expired', 'deleted');--> statement-breakpoint
CREATE TABLE "device_push_tokens" (
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
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"storage_bucket" varchar(100) NOT NULL,
	"storage_region" varchar(20) DEFAULT 'fr-par' NOT NULL,
	"gemini_file_uri" varchar(500),
	"gemini_expires_at" timestamp with time zone,
	"educational_context" jsonb DEFAULT '{}'::jsonb,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_restore_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"parent_id" varchar(255) NOT NULL,
	"child_id" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_restore_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pronote_child_mappings" (
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
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "establishments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "establishments" CASCADE;--> statement-breakpoint
ALTER TABLE "pronote_connections" DROP CONSTRAINT "pronote_connections_user_id_unique";--> statement-breakpoint
ALTER TABLE "pronote_connections" DROP CONSTRAINT "pronote_connections_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "pronote_connections" DROP CONSTRAINT "pronote_connections_establishment_rne_fkey";
--> statement-breakpoint
DROP INDEX "idx_pronote_connections_establishment";--> statement-breakpoint
ALTER TABLE "pronote_connections" ALTER COLUMN "account_kind" SET DEFAULT 7;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN "revenuecat_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN "revenuecat_subscription_id" varchar(255);--> statement-breakpoint
ALTER TABLE "pronote_connections" ADD COLUMN "parent_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "pronote_connections" ADD COLUMN "establishment_name" varchar(300) NOT NULL;--> statement-breakpoint
ALTER TABLE "pronote_connections" ADD COLUMN "pronote_resources" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_restore_token" ADD CONSTRAINT "parent_restore_token_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_restore_token" ADD CONSTRAINT "parent_restore_token_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronote_child_mappings" ADD CONSTRAINT "pronote_child_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."pronote_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronote_child_mappings" ADD CONSTRAINT "pronote_child_mappings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_device_push_tokens_user_id" ON "device_push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_device_push_tokens_token" ON "device_push_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_device_push_tokens_active" ON "device_push_tokens" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_files_user_id" ON "files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_files_status" ON "files" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_files_storage_key" ON "files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "idx_files_created_at" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_parent_restore_token_token" ON "parent_restore_token" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_parent_restore_token_parent_id" ON "parent_restore_token" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_parent_restore_token_expires_at" ON "parent_restore_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_pronote_child_mappings_connection" ON "pronote_child_mappings" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_pronote_child_mappings_child" ON "pronote_child_mappings" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_event_id" ON "webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_source" ON "webhook_events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_expires_at" ON "webhook_events" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "pronote_connections" ADD CONSTRAINT "pronote_connections_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_family_billing_revenuecat_customer" ON "family_billing" USING btree ("revenuecat_customer_id");--> statement-breakpoint
ALTER TABLE "pronote_connections" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "pronote_connections" DROP COLUMN "establishment_rne";--> statement-breakpoint
ALTER TABLE "pronote_connections" DROP COLUMN "last_homework_sync";--> statement-breakpoint
ALTER TABLE "pronote_connections" DROP COLUMN "last_grades_sync";--> statement-breakpoint
ALTER TABLE "pronote_connections" DROP COLUMN "last_timetable_sync";--> statement-breakpoint
ALTER TABLE "pronote_connections" ADD CONSTRAINT "pronote_connections_parent_id_unique" UNIQUE("parent_id");--> statement-breakpoint
DROP TYPE "public"."establishment_status";--> statement-breakpoint
DROP TYPE "public"."establishment_type";