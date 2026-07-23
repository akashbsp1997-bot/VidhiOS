ALTER TABLE "model_questions" ADD COLUMN "format" text DEFAULT 'descriptive' NOT NULL;--> statement-breakpoint
ALTER TABLE "model_questions" ADD COLUMN "options" jsonb;--> statement-breakpoint
ALTER TABLE "model_questions" ADD COLUMN "correct_index" integer;--> statement-breakpoint
ALTER TABLE "model_questions" ADD COLUMN "explanation" text;