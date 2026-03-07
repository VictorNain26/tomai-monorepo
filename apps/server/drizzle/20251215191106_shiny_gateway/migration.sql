DROP INDEX "idx_verification_value";--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "value" SET DATA TYPE text;