-- Migration 0007: Better Auth Admin Plugin - Impersonation support
-- Best Practice 2026: Built-in impersonation for Quick Switch feature
-- Made idempotent for safe re-runs

-- Add impersonatedBy column to session table (required by Better Auth admin plugin)
DO $$ BEGIN
    ALTER TABLE "session" ADD COLUMN "impersonated_by" varchar(255);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Add foreign key constraint for impersonatedBy
DO $$ BEGIN
    ALTER TABLE "session" ADD CONSTRAINT "session_impersonated_by_fkey"
    FOREIGN KEY ("impersonated_by") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add index for efficient impersonation lookups
CREATE INDEX IF NOT EXISTS "idx_session_impersonated_by" ON "session" USING btree ("impersonated_by");
