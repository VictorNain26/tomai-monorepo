CREATE TABLE "parent_child" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_user_id" varchar(255) NOT NULL,
	"child_user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_child_pair_unique" UNIQUE("parent_user_id","child_user_id")
);
--> statement-breakpoint
ALTER TABLE "pronote_child_resources" DROP CONSTRAINT "pronote_child_resources_child_unique";--> statement-breakpoint
ALTER TABLE "pronote_credentials" DROP CONSTRAINT "pronote_credentials_user_id_unique";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_parent_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_user_parent_id";--> statement-breakpoint
ALTER TABLE "pronote_child_resources" ADD COLUMN "credential_id" uuid;--> statement-breakpoint
ALTER TABLE "pronote_credentials" ADD COLUMN "establishment_url" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_child_user_id_fkey" FOREIGN KEY ("child_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_parent_child_parent" ON "parent_child" USING btree ("parent_user_id");--> statement-breakpoint
CREATE INDEX "idx_parent_child_child" ON "parent_child" USING btree ("child_user_id");--> statement-breakpoint
ALTER TABLE "pronote_child_resources" ADD CONSTRAINT "pronote_child_resources_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "public"."pronote_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "parent_id";--> statement-breakpoint
ALTER TABLE "pronote_child_resources" ADD CONSTRAINT "pronote_child_resources_parent_child_unique" UNIQUE("parent_user_id","child_user_id");--> statement-breakpoint
ALTER TABLE "pronote_credentials" ADD CONSTRAINT "pronote_credentials_user_establishment_unique" UNIQUE("user_id","establishment_url");