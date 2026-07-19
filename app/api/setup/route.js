export const maxDuration = 60;

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
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
    key_provisions jsonb NOT NULL DEFAULT '[]',
    case_law jsonb NOT NULL DEFAULT '[]',
    perspectives jsonb NOT NULL DEFAULT '[]',
    answer_framework text,
    examples jsonb NOT NULL,
    exercises jsonb NOT NULL,
    mnemonics jsonb NOT NULL,
    visual_outline jsonb NOT NULL,
    generated_at timestamp NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS visual_image_data_uri text`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS key_provisions jsonb NOT NULL DEFAULT '[]'`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS case_law jsonb NOT NULL DEFAULT '[]'`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS perspectives jsonb NOT NULL DEFAULT '[]'`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS answer_framework text`,
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

    log.push(`Seeding ${syllabusSeed.length} subtopics (1 bulk statement)...`);
    if (syllabusSeed.length) {
      await db
        .insert(subtopics)
        .values(syllabusSeed)
        .onConflictDoUpdate({ target: subtopics.id, set: { pyqFrequency: sql`excluded.pyq_frequency` } });
    }

    log.push("Setting up stage tracking for any new subtopics (1 bulk statement)...");
    const masteryInserted = await db
      .insert(mastery)
      .values(syllabusSeed.map((row) => ({ subtopicId: row.id })))
      .onConflictDoNothing({ target: mastery.subtopicId })
      .returning({ id: mastery.subtopicId });
    log.push(`${masteryInserted.length} new mastery/stage rows initialized (existing ones left untouched).`);

    log.push(`Seeding ${pyqsSeed.length} PYQs (1 bulk statement)...`);
    if (pyqsSeed.length) {
      await db.insert(pyqs).values(pyqsSeed).onConflictDoNothing({ target: pyqs.id });
    }

    log.push(`Seeding ${sourcesSeed.length} starter sources...`);
    const existingSources = await db.select({ subtopicId: sources.subtopicId, url: sources.url }).from(sources);
    const existingKeys = new Set(existingSources.map((s) => `${s.subtopicId}|${s.url}`));
    const newSources = sourcesSeed.filter((row) => !existingKeys.has(`${row.subtopicId}|${row.url}`));
    if (newSources.length) {
      await db.insert(sources).values(newSources);
    }
    log.push(`${newSources.length} new source rows inserted.`);

    return NextResponse.json({
      status: "ok",
      log,
      next: "Go to your app's home page, then tap any subtopic to go through Teach -> Grasp -> Remember -> Test.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ status: "error", error: err.message, log }, { status: 500 });
  }
}
