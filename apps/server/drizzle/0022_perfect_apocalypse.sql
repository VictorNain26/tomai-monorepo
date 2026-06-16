CREATE TABLE "pronote_child_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_user_id" varchar(255) NOT NULL,
	"child_user_id" varchar(255) NOT NULL,
	"resource_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pronote_child_resources_child_unique" UNIQUE("child_user_id")
);
--> statement-breakpoint
ALTER TABLE "pronote_child_resources" ADD CONSTRAINT "pronote_child_resources_parent_user_id_user_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronote_child_resources" ADD CONSTRAINT "pronote_child_resources_child_user_id_user_id_fk" FOREIGN KEY ("child_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;