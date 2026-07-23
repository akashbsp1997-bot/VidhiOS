ALTER TABLE "mastery" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "mastery" ADD COLUMN "self_status" text DEFAULT 'not-started' NOT NULL;