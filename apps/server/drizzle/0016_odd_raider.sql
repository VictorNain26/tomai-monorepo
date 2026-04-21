CREATE TABLE "session_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"summary_text" text NOT NULL,
	"summary_embedding" vector(1024) NOT NULL,
	"concepts_covered" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer,
	"outcome" varchar(32) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ttl_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "session_episodes" ADD CONSTRAINT "session_episodes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_episodes" ADD CONSTRAINT "session_episodes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_episodes_user_id" ON "session_episodes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_episodes_created_at" ON "session_episodes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_session_episodes_ttl" ON "session_episodes" USING btree ("ttl_until");--> statement-breakpoint
CREATE INDEX "idx_session_episodes_embedding" ON "session_episodes" USING hnsw ("summary_embedding" vector_cosine_ops);