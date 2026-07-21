-- No backfill statement in this migration, unlike 0006's unconditional
-- UPDATE for practice_generated_at. lesson_modules starts EMPTY for every
-- subtopic, including ones with a fully-generated pre-existing `lessons`
-- row -- turning that flat content into per-module rows would require
-- running a fresh AI decomposition call (generateModulePlan) over existing
-- data, which can't run inside a SQL migration, and would be lossy (old
-- examples/exercises apply to the WHOLE subtopic, not a coherent module
-- slice). Subtopics with a complete legacy `lessons` row instead keep
-- serving the old flat Teach/Grasp/Remember/Test UI unchanged via
-- app/api/lesson/route.js, with an explicit "Upgrade to modules" action
-- (app/api/module-lesson/route.js's `?upgrade=true`) that runs the plan
-- phase on demand.
CREATE TABLE "lesson_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"subtopic_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"title" text NOT NULL,
	"scope_note" text DEFAULT '' NOT NULL,
	"teach_content" text,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mnemonic" jsonb,
	"practice_generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_modules_subtopic_order_unique" UNIQUE("subtopic_id","order_index")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "module_id" integer;--> statement-breakpoint
ALTER TABLE "mastery" ADD COLUMN "current_module_index" integer;--> statement-breakpoint
ALTER TABLE "model_questions" ADD COLUMN "module_id" integer;--> statement-breakpoint
ALTER TABLE "lesson_modules" ADD CONSTRAINT "lesson_modules_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_module_id_lesson_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."lesson_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_questions" ADD CONSTRAINT "model_questions_module_id_lesson_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."lesson_modules"("id") ON DELETE no action ON UPDATE no action;