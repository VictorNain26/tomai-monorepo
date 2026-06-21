ALTER TABLE "pronote_child_resources" ADD COLUMN "class_name" varchar(255);--> statement-breakpoint
ALTER TABLE "pronote_child_resources" ADD COLUMN "establishment_name" varchar(255);--> statement-breakpoint
ALTER TABLE "pronote_credentials" ADD COLUMN "establishment_name" varchar(255);--> statement-breakpoint
ALTER TABLE "pronote_child_resources" ADD CONSTRAINT "pronote_child_resources_credential_resource_unique" UNIQUE("credential_id","resource_id");