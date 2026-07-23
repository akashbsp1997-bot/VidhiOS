CREATE TABLE "essay_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"essay_topic_id" text NOT NULL,
	"essay_text" text NOT NULL,
	"score" integer,
	"feedback" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essay_guides" (
	"essay_topic_id" text PRIMARY KEY NOT NULL,
	"approach_notes" text NOT NULL,
	"key_dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quotes_and_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_outline" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essay_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_text" text NOT NULL,
	"category" text NOT NULL,
	"source" text NOT NULL,
	"year" integer
);
--> statement-breakpoint
ALTER TABLE "essay_attempts" ADD CONSTRAINT "essay_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_attempts" ADD CONSTRAINT "essay_attempts_essay_topic_id_essay_topics_id_fk" FOREIGN KEY ("essay_topic_id") REFERENCES "public"."essay_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_guides" ADD CONSTRAINT "essay_guides_essay_topic_id_essay_topics_id_fk" FOREIGN KEY ("essay_topic_id") REFERENCES "public"."essay_topics"("id") ON DELETE no action ON UPDATE no action;