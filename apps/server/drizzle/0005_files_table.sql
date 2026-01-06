-- Migration: Add files table for Scaleway Object Storage
-- Created manually for presigned URL upload feature

-- Create file_status enum
DO $$ BEGIN
    CREATE TYPE "public"."file_status" AS ENUM('pending', 'uploaded', 'processing', 'ready', 'expired', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create files table
CREATE TABLE IF NOT EXISTS "files" (
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

-- Add foreign key constraint
DO $$ BEGIN
    ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_files_user_id" ON "files" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_files_status" ON "files" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_files_storage_key" ON "files" USING btree ("storage_key");
CREATE INDEX IF NOT EXISTS "idx_files_created_at" ON "files" USING btree ("created_at");
