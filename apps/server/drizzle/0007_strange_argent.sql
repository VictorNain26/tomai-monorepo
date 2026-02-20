CREATE TABLE "student_cognitive_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb,
	"weaknesses" jsonb DEFAULT '[]'::jsonb,
	"preferred_style" varchar(50),
	"observations" jsonb DEFAULT '[]'::jsonb,
	"last_updated_by_agent" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_cognitive_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "subject" SET DEFAULT 'général';--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "impersonated_by" varchar(255);--> statement-breakpoint
ALTER TABLE "student_cognitive_profiles" ADD CONSTRAINT "student_cognitive_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_student_cognitive_profiles_user_id" ON "student_cognitive_profiles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_impersonated_by_fkey" FOREIGN KEY ("impersonated_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_impersonated_by" ON "session" USING btree ("impersonated_by");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "selected_lv2";