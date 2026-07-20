export const maxDuration = 60;

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, pyqs, sources, mastery } from "../../../db/schema.js";
import { syllabusSeed } from "../../../db/seed/syllabus.js";
import { pyqsSeed } from "../../../db/seed/pyqs.js";
import { sourcesSeed } from "../../../db/seed/sources.js";

// Table/column creation used to live here as hand-written DDL, run on every
// visit to this route. As of Phase 1 (see docs/ARCHITECTURE.md and the
// Phase 1 plan), schema changes are real drizzle-kit migrations (drizzle/
// *.sql, applied via `npm run db:migrate`) instead -- this route now only
// owns idempotent app-level *data* seeding, not schema.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=. Check SETUP_SECRET in your Vercel env vars." }, { status: 401 });
  }

  const log = [];
  let hadError = false;

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
