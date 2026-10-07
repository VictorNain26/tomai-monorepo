CREATE TYPE "public"."message_role" AS ENUM('student', 'tutor');--> statement-breakpoint
CREATE TYPE "public"."subject_family" AS ENUM('mathematiques', 'francais', 'langues', 'sciences', 'histoire-geo', 'general');--> statement-breakpoint
CREATE TABLE "distress_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"session_id" uuid,
	"detected_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sheet" jsonb,
	"uncertain" boolean NOT NULL,
	"drawn_forms" jsonb NOT NULL,
	"math_check" text NOT NULL,
	"prompt_version" text NOT NULL,
	"hint_level" integer DEFAULT 0 NOT NULL,
	"steps_done" integer DEFAULT 0 NOT NULL,
	"stuck_turns" integer DEFAULT 0 NOT NULL,
	"hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"solved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position" bigint GENERATED ALWAYS AS IDENTITY (sequence name "message_position_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"text" text NOT NULL,
	"model_messages" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"title" text,
	"subject" "subject_family",
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "distress_event" ADD CONSTRAINT "distress_event_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distress_event" ADD CONSTRAINT "distress_event_session_id_study_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_session_id_study_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_session_id_study_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "distress_event_session_id_idx" ON "distress_event" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "distress_event_student_id_created_at_idx" ON "distress_event" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "exercise_session_id_created_at_idx" ON "exercise" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "message_session_id_position_idx" ON "message" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "study_session_student_id_created_at_idx" ON "study_session" USING btree ("student_id","created_at");