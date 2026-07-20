-- Phase 1, PR1: additive-only schema for multi-subject + multi-user foundation.
--
-- Hand-edited from drizzle-kit's auto-generated output: this DB was originally
-- bootstrapped via hand-written DDL in app/api/setup/route.js (not versioned
-- migrations), so drizzle-kit has no prior migration history and generated a
-- full CREATE TABLE for all 9 tables it now sees in db/schema.js, including
-- the 7 that already exist in production. Everything below is scoped to only
-- what's actually new: one new table, five new nullable columns, and their
-- FKs. `auth.users` is Supabase's own pre-existing table -- never created or
-- altered here, only referenced.
--
-- Safe to run against the live DB as-is: every new column is nullable, so no
-- existing row or existing app code path is affected until later PRs (backfill,
-- NOT NULL tightening, and the app-code changes that depend on these columns)
-- land.

CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"category" text NOT NULL,
	"exam_stage" text NOT NULL,
	"answer_format" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subtopics" ADD COLUMN "subject_id" text;
--> statement-breakpoint
ALTER TABLE "pyqs" ADD COLUMN "subject_id" text;
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "source_tier" text;
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "mastery" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pyqs" ADD CONSTRAINT "pyqs_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mastery" ADD CONSTRAINT "mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
