CREATE TYPE "public"."memory_answer" AS ENUM('accepted', 'declined');--> statement-breakpoint
CREATE TABLE "learner_notion_reset" (
	"student_id" text NOT NULL,
	"notion_id" text NOT NULL,
	"reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_notion_reset_student_id_notion_id_pk" PRIMARY KEY("student_id","notion_id")
);
--> statement-breakpoint
ALTER TABLE "student_profile" ADD COLUMN "memory_proposed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_profile" ADD COLUMN "memory_answer" "memory_answer";--> statement-breakpoint
ALTER TABLE "student_profile" ADD COLUMN "memory_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "turn_record" ADD COLUMN "error_type" text;--> statement-breakpoint
ALTER TABLE "learner_notion_reset" ADD CONSTRAINT "learner_notion_reset_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;