CREATE TABLE "pronote_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"encrypted_token" text NOT NULL,
	"encrypted_metadata" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pronote_credentials_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DROP TABLE "pronote_child_mappings" CASCADE;--> statement-breakpoint
DROP TABLE "pronote_connections" CASCADE;--> statement-breakpoint
ALTER TABLE "pronote_credentials" ADD CONSTRAINT "pronote_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."pronote_connection_status";