CREATE TABLE "daily_results_digests" (
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"item_count" integer NOT NULL,
	"avg_score" real NOT NULL,
	"by_subtopic" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_results_digests_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "daily_results_digests" ADD CONSTRAINT "daily_results_digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;