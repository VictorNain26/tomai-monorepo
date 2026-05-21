CREATE TABLE "retrieval_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255),
	"session_id" uuid,
	"query_hash" varchar(64) NOT NULL,
	"niveau" varchar(32) NOT NULL,
	"matiere" varchar(64),
	"results_count" integer NOT NULL,
	"avg_score" real,
	"duration_ms" integer NOT NULL,
	"strategy" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_retrieval_audit_user_id" ON "retrieval_audit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_retrieval_audit_created_at" ON "retrieval_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_retrieval_audit_user_time" ON "retrieval_audit" USING btree ("user_id","created_at");