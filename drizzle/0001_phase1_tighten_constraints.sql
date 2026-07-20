-- Phase 1, PR3: tighten NOT NULL/PK constraints now that PR2's reset left
-- attempts/mastery empty and subtopics/pyqs fully backfilled with subjectId.
--
-- Hand-edited: drizzle-kit generate could not determine the name of
-- mastery's existing single-column primary key (its own comment says this
-- is a known limitation), so it left a placeholder rather than a working
-- DROP CONSTRAINT statement. Rather than hardcode a guessed name (Postgres's
-- default "mastery_pkey" convention is very likely correct here, but this
-- can't be tested against production before running), this looks the actual
-- constraint name up at migration time and drops whatever it finds.

ALTER TABLE "attempts" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "mastery" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "pyqs" ALTER COLUMN "subject_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "subtopics" ALTER COLUMN "subject_id" SET NOT NULL;
--> statement-breakpoint
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT constraint_name INTO pk_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND table_name = 'mastery' AND constraint_type = 'PRIMARY KEY';
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE mastery DROP CONSTRAINT %I', pk_name);
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "mastery" ADD CONSTRAINT "mastery_user_id_subtopic_id_pk" PRIMARY KEY("user_id","subtopic_id");
