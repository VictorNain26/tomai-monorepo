-- Idempotent enum creation (may already exist from db:push)
DO $$ BEGIN
    CREATE TYPE "public"."pronote_connection_status" AS ENUM('active', 'expired', 'error', 'disconnected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Add 'concept' card type (required fix for learning cards generation)
DO $$ BEGIN
    ALTER TYPE "public"."card_type" ADD VALUE 'concept' BEFORE 'flashcard';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Idempotent table creation (may already exist from db:push)
CREATE TABLE IF NOT EXISTS "pronote_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"establishment_rne" varchar(8) NOT NULL,
	"encrypted_token" text NOT NULL,
	"instance_url" varchar(400) NOT NULL,
	"pronote_username" varchar(100) NOT NULL,
	"device_uuid" varchar(36) NOT NULL,
	"account_kind" integer DEFAULT 3 NOT NULL,
	"status" "pronote_connection_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"token_expires_at" timestamp with time zone NOT NULL,
	"last_refresh_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_homework_sync" timestamp with time zone,
	"last_grades_sync" timestamp with time zone,
	"last_timetable_sync" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pronote_connections_user_id_unique" UNIQUE("user_id")
);--> statement-breakpoint

-- Idempotent FK constraints
DO $$ BEGIN
    ALTER TABLE "pronote_connections" ADD CONSTRAINT "pronote_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
    ALTER TABLE "pronote_connections" ADD CONSTRAINT "pronote_connections_establishment_rne_fkey" FOREIGN KEY ("establishment_rne") REFERENCES "public"."establishments"("rne") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Idempotent indexes
CREATE INDEX IF NOT EXISTS "idx_pronote_connections_status" ON "pronote_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pronote_connections_expires" ON "pronote_connections" USING btree ("token_expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pronote_connections_establishment" ON "pronote_connections" USING btree ("establishment_rne");