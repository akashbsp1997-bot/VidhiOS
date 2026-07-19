export const maxDuration = 60;

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, pyqs, sources, mastery } from "../../../db/schema.js";
import { syllabusSeed } from "../../../db/seed/syllabus.js";
import { pyqsSeed } from "../../../db/seed/pyqs.js";
import { sourcesSeed } from "../../../db/seed/sources.js";

const DDL = [
  { name: "subtopics", sql: `CREATE TABLE IF NOT EXISTS subtopics (
    id text PRIMARY KEY,
    paper integer NOT NULL,
    section text NOT NULL,
    topic_text text NOT NULL,
    pyq_frequency integer NOT NULL DEFAULT 0
  )` },
  { name: "sources", sql: `CREATE TABLE IF NOT EXISTS sources (
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
  )` },
  { name: "pyqs", sql: `CREATE TABLE IF NOT EXISTS pyqs (
    id text PRIMARY KEY,
    paper integer NOT NULL,
    year integer NOT NULL,
    slot integer NOT NULL,
    sec text NOT NULL,
    sub text NOT NULL,
    marks integer NOT NULL,
    topics text[] NOT NULL,
    question_text text NOT NULL
  )` },
  { name: "model_questions", sql: `CREATE TABLE IF NOT EXISTS model_questions (
    id serial PRIMARY KEY,
    subtopic_id text NOT NULL REFERENCES subtopics(id),
    difficulty_tier integer NOT NULL,
    marks integer NOT NULL DEFAULT 15,
    question_text text NOT NULL,
    grounded_source_ids integer[],
    created_at timestamp NOT NULL DEFAULT now()
  )` },
  { name: "attempts", sql: `CREATE TABLE IF NOT EXISTS attempts (
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
  )` },
  { name: "mastery", sql: `CREATE TABLE IF NOT EXISTS mastery (
    subtopic_id text PRIMARY KEY REFERENCES subtopics(id),
    mastery_score real NOT NULL DEFAULT 0,
    attempts_count integer NOT NULL DEFAULT 0,
    current_tier integer NOT NULL DEFAULT 1,
    recent_scores jsonb NOT NULL DEFAULT '[]',
    last_attempt_at timestamp
  )` },
  { name: "mastery.stage", sql: `ALTER TABLE mastery ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'teach'` },
  { name: "lessons", sql: `CREATE TABLE IF NOT EXISTS lessons (
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
  )` },
  { name: "lessons.visual_image_data_uri", sql: `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS visual_image_data_uri text` },
  { name: "lessons.key_provisions", sql: `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS key_provisions jsonb NOT NULL DEFAULT '[]'` },
  { name: "lessons.case_law", sql: `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS case_law jsonb NOT NULL DEFAULT '[]'` },
  { name: "lessons.perspectives", sql: `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS perspectives jsonb NOT NULL DEFAULT '[]'` },
  { name: "lessons.answer_framework", sql: `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS answer_framework text` },
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=. Check SETUP_SECRET in your Vercel env vars." }, { status: 401 });
  }

  const log = [];
  let hadError = false;

  for (const step of DDL) {
    try {
      await db.execute(sql.raw(step.sql));
      log.push(`OK  ddl:${step.name}`);
    } catch (err) {
      hadError = true;
      log.push(`FAIL ddl:${step.name} -- ${err.message}`);
    }
  }

  try {
    await db
      .insert(subtopics)
      .values(syllabusSeed)
      .onConflictDoUpdate({ target: subtopics.id, set: { pyqFrequency: sql`excluded.pyq_frequency` } });
    log.push(`OK  seed:subtopics (${syllabusSeed.length})`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL seed:subtopics -- ${err.message}`);
  }

  try {
    const inserted = await db
      .insert(mastery)
      .values(syllabusSeed.map((row) => ({ subtopicId: row.id })))
      .onConflictDoNothing({ target: mastery.subtopicId })
      .returning({ id: mastery.subtopicId });
    log.push(`OK  seed:mastery (${inserted.length} new)`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL seed:mastery -- ${err.message}`);
  }

  try {
    await db.insert(pyqs).values(pyqsSeed).onConflictDoNothing({ target: pyqs.id });
    log.push(`OK  seed:pyqs (${pyqsSeed.length})`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL seed:pyqs -- ${err.message}`);
  }

  try {
    const existingSources = await db.select({ subtopicId: sources.subtopicId, url: sources.url }).from(sources);
    const existingKeys = new Set(existingSources.map((s) => `${s.subtopicId}|${s.url}`));
    const newSources = sourcesSeed.filter((row) => !existingKeys.has(`${row.subtopicId}|${row.url}`));
    if (newSources.length) await db.insert(sources).values(newSources);
    log.push(`OK  seed:sources (${newSources.length} new)`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL seed:sources -- ${err.message}`);
  }

  return NextResponse.json(
    {
      status: hadError ? "partial" : "ok",
      log,
      next: hadError
        ? "One or more steps failed -- read the FAIL lines above, that's the exact statement and error."
        : "Go to your app's home page, then tap any subtopic to go through Teach -> Grasp -> Remember -> Test.",
    },
    { status: hadError ? 207 : 200 }
  );
}
