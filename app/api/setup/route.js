// app/api/setup/route.js
//
// Visit this URL ONCE after deploying, in any browser:
//   https://<your-app>.vercel.app/api/setup?key=<SETUP_SECRET>
//
// Creates every table (raw SQL, hand-matched to db/schema.js) and seeds the
// 81 subtopics / 168 PYQs / starter sources — the browser-only replacement
// for running `npm run db:push && npm run seed` in a terminal. Safe to
// re-visit: CREATE TABLE IF NOT EXISTS + the same upsert/insert-if-missing
// logic as scripts/seed.js, so it won't duplicate or wipe anything.

import { NextResponse } from "next/server";
import { sql, and, eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, pyqs, sources, mastery } from "../../../db/schema.js";
import { syllabusSeed } from "../../../db/seed/syllabus.js";
import { pyqsSeed } from "../../../db/seed/pyqs.js";
import { sourcesSeed } from "../../../db/seed/sources.js";

const DDL = [
  `CREATE TABLE IF NOT EXISTS subtopics (
    id text PRIMARY KEY,
    paper integer NOT NULL,
    section text NOT NULL,
    topic_text text NOT NULL,
    pyq_frequency integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS sources (
    id serial PRIMARY KEY,
    subtopic_id text NOT NULL REFERENCES subtopics(id),
    title text NOT NULL,
    url text NOT NULL,
    source_type text NOT NULL,
    official boolean NOT NULL DEFAULT true,
    added_at timestamp NOT NULL DEFAULT now(),
    fetched_at timestamp,
    extracted_text text,
    status text NOT NULL DEFAULT 'pending',
    error_msg text
  )`,
  `CREATE TABLE IF NOT EXISTS pyqs (
    id text PRIMARY KEY,
    paper integer NOT NULL,
    year integer NOT NULL,
    slot integer NOT NULL,
    sec text NOT NULL,
    sub text NOT NULL,
    marks integer NOT NULL,
    topics text[] NOT NULL,
    question_text text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS model_questions (
    id serial PRIMARY KEY,
    subtopic_id text NOT NULL REFERENCES subtopics(id),
    difficulty_tier integer NOT NULL,
    marks integer NOT NULL DEFAULT 15,
    question_text text NOT NULL,
    grounded_source_ids integer[],
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS attempts (
    id serial PRIMARY KEY,
    subtopic_id text NOT NULL REFERENCES subtopics(id),
    question_source text NOT NULL,
    question_ref_id text NOT NULL,
    question_text_snapshot text NOT NULL,
    difficulty_tier integer NOT NULL,
    marks integer NOT NULL,
    answer_text text NOT NULL,
    score integer,
    feedback jsonb,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mastery (
    subtopic_id text PRIMARY KEY REFERENCES subtopics(id),
    mastery_score real NOT NULL DEFAULT 0,
    attempts_count integer NOT NULL DEFAULT 0,
    current_tier integer NOT NULL DEFAULT 1,
    recent_scores jsonb NOT NULL DEFAULT '[]',
    last_attempt_at timestamp
  )`,
  `ALTER TABLE mastery ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'teach'`,
  `CREATE TABLE IF NOT EXISTS lessons (
    subtopic_id text PRIMARY KEY REFERENCES subtopics(id),
    teach_content text NOT NULL,
    examples jsonb NOT NULL,
    exercises jsonb NOT NULL,
    mnemonics jsonb NOT NULL,
    visual_outline jsonb NOT NULL,
    generated_at timestamp NOT NULL DEFAULT now()
  )`,
];


export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=. Check SETUP_SECRET in your Vercel env vars." }, { status: 401 });
  }

  const log = [];
  try {
    log.push("Creating tables...");
    for (const statement of DDL) {
      await db.execute(sql.raw(statement));
    }
    log.push("Tables ready.");

        log.push(`Seeding ${syllabusSeed.length} subtopics...`);
    for (const row of syllabusSeed) {
      await db
        .insert(subtopics)
        .values(row)
        .onConflictDoUpdate({ target: subtopics.id, set: { pyqFrequency: row.pyqFrequency } });
    }

    log.push("Setting up stage tracking for any new subtopics...");
    let masteryRowsInserted = 0;
    for (const row of syllabusSeed) {
      const inserted = await db
        .insert(mastery)
        .values({ subtopicId: row.id })
        .onConflictDoNothing({ target: mastery.subtopicId })
        .returning({ id: mastery.subtopicId });
      if (inserted.length > 0) masteryRowsInserted++;
    }
    log.push(`${masteryRowsInserted} new mastery/stage rows initialized (existing ones left untouched).`);


    log.push(`Seeding ${pyqsSeed.length} PYQs...`);
    for (const row of pyqsSeed) {
      await db.insert(pyqs).values(row).onConflictDoNothing({ target: pyqs.id });
    }

    log.push(`Seeding ${sourcesSeed.length} starter sources...`);
    let sourcesInserted = 0;
    for (const row of sourcesSeed) {
      const existing = await db
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.subtopicId, row.subtopicId), eq(sources.url, row.url)));
      if (existing.length === 0) {
        await db.insert(sources).values(row);
        sourcesInserted++;
      }
    }
    log.push(`${sourcesInserted} new source rows inserted.`);

    return NextResponse.json({
      status: "ok",
      log,
      next: "Go to your app's home page — you should see 81 subtopics with mastery bars. Then visit /practice to try the adaptive loop.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ status: "error", error: err.message, log }, { status: 500 });
  }
}
