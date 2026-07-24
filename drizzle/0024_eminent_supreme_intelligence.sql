CREATE TABLE "pace_checkpoints" (
	"user_id" uuid NOT NULL,
	"window_index" integer NOT NULL,
	"window_start_day" integer NOT NULL,
	"anchor_mastery_pct" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pace_checkpoints_user_id_window_index_pk" PRIMARY KEY("user_id","window_index")
);
--> statement-breakpoint
ALTER TABLE "pace_checkpoints" ADD CONSTRAINT "pace_checkpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;