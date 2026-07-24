CREATE TABLE "quant_lessons" (
	"subtopic_id" text PRIMARY KEY NOT NULL,
	"explanation" text NOT NULL,
	"shortcuts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quant_lessons" ADD CONSTRAINT "quant_lessons_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;