ALTER TABLE "lessons" ALTER COLUMN "examples" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "exercises" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "mnemonics" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "visual_outline" SET DEFAULT '{"label":"Overview","children":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "practice_generated_at" timestamp;--> statement-breakpoint
-- Every row that exists at this point was produced by the old atomic
-- generateLesson() (core + practice + image all in one request), so it's
-- unconditionally complete -- no per-row conditional logic needed. Without
-- this, existing rows would read practice_generated_at IS NULL and the
-- lazy-phase route (app/api/lesson/route.js) would regenerate practice
-- content that's already there.
UPDATE "lessons" SET "practice_generated_at" = "generated_at" WHERE "practice_generated_at" IS NULL;