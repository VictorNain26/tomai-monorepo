CREATE TABLE "student_subject_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"concepts_seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"difficulties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mastery_notes" text,
	"sessions_count" integer DEFAULT 0 NOT NULL,
	"last_outcome" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ttl_until" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_subject_profile_user_subject" UNIQUE("user_id","subject")
);
--> statement-breakpoint
ALTER TABLE "student_subject_profile" ADD CONSTRAINT "student_subject_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_subject_profile_user" ON "student_subject_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subject_profile_ttl" ON "student_subject_profile" USING btree ("ttl_until");