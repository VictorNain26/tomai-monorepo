CREATE TABLE "distress_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" uuid NOT NULL,
	"detected_by" varchar(16) NOT NULL,
	"selfharm_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "distress_events" ADD CONSTRAINT "distress_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distress_events" ADD CONSTRAINT "distress_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_distress_events_session" ON "distress_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_distress_events_user_created" ON "distress_events" USING btree ("user_id","created_at");