CREATE TABLE "interview_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"hometown" text DEFAULT '' NOT NULL,
	"education" text DEFAULT '' NOT NULL,
	"work_experience" text DEFAULT '' NOT NULL,
	"hobbies" text DEFAULT '' NOT NULL,
	"service_preference" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"questions" jsonb NOT NULL,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_profiles" ADD CONSTRAINT "interview_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;