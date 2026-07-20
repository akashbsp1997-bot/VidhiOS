export const maxDuration = 60;

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, pyqs, sources, subjects } from "../../../db/schema.js";
import { syllabusSeed } from "../../../db/seed/syllabus.js";
import { pyqsSeed } from "../../../db/seed/pyqs.js";
import { sourcesSeed } from "../../../db/seed/sources.js";
import { subjectsSeed } from "../../../db/seed/subjects.js";
import { gs2SyllabusSeed } from "../../../db/seed/gs2-syllabus.js";
import { gs2PyqsSeed } from "../../../db/seed/gs2-pyqs.js";

// syllabusSeed/pyqsSeed (Law Optional) predate the subjectId column and
// don't carry it on each row (it was backfilled once, directly in the DB,
// by app/api/setup/phase1-reset/route.js) -- mapped in here rather than
// editing those large existing files, so this route can insert/upsert them
// alongside every other subject uniformly. subjectId is NOT NULL, so
// omitting it here would fail the whole batch insert, not just those rows.
const allSubtopicsSeed = [
  ...syllabusSeed.map((s) => ({ ...s, subjectId: "law-optional" })),
  ...gs2SyllabusSeed,
];
const allPyqsSeed = [
  ...pyqsSeed.map((p) => ({ ...p, subjectId: "law-optional" })),
  ...gs2PyqsSeed,
];

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
      .insert(subjects)
      .values(subjectsSeed)
      .onConflictDoUpdate({ target: subjects.id, set: { displayName: sql`excluded.display_name`, active: sql`excluded.active` } });
    log.push(`OK  seed:subjects (${subjectsSeed.length})`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL seed:subjects -- ${err.message}`);
  }

  try {
    await db
      .insert(subtopics)
      .values(allSubtopicsSeed)
      .onConflictDoUpdate({ target: subtopics.id, set: { pyqFrequency: sql`excluded.pyq_frequency` } });
    log.push(`OK  seed:subtopics (${allSubtopicsSeed.length})`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL seed:subtopics -- ${err.message}`);
  }

  try {
    await db.insert(pyqs).values(allPyqsSeed).onConflictDoNothing({ target: pyqs.id });
    log.push(`OK  seed:pyqs (${allPyqsSeed.length})`);
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
