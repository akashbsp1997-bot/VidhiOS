ALTER TABLE "sources" ADD COLUMN "ncert_level" text;
--> statement-breakpoint
-- Every NCERT source in this app as of 2026-07-22 was sourced from senior
-- secondary (class 11-12) textbooks -- Political Science/Sociology/History
-- NCERTs for law-optional and gs2's PYQ-relevant subtopics, per the sourcing
-- work done earlier this session. Explicit product decision, not a guess:
-- backfill every existing untagged NCERT row to 'senior' rather than leaving
-- it null (which would fall back to the same 'senior' default in scoring
-- anyway -- see lib/adaptive/unlocks.js -- but an explicit tag is honest
-- about what's actually known instead of silently relying on a fallback).
UPDATE "sources" SET "ncert_level" = 'senior' WHERE "source_tier" = 'ncert' AND "ncert_level" IS NULL;