export const maxDuration = 60;

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { isNull } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { subjects, subtopics, pyqs, attempts, mastery } from "../../../../db/schema.js";

// One-time Phase 1 data step, run once after app/api/migrate has applied the
// additive schema (see the Phase 1 plan): seeds the "law-optional" subjects
// row, backfills subjectId on the existing subtopics/pyqs, and RESETS
// attempts/mastery (truncate) since that pre-multi-user data has no owning
// user and was confirmed with the operator as safe to discard rather than
// migrate to an account.
//
// HTTP-triggered (not a local script) for the same reason app/api/migrate
// is: this project is developed via GitHub's mobile web editor with no
// local terminal, and this sandbox has no direct route to the database
// either -- only the deployed app does. Gated by SETUP_SECRET *and* a
// second explicit `confirm` param, since unlike /api/setup and
// /api/migrate this step is destructive and irreversible.
//
// Safe to re-run for the subjects/subtopics/pyqs steps (idempotent
// upserts). The attempts/mastery truncate is NOT idempotent in the sense
// that it deletes again on every call -- intended to be run exactly once.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const confirm = searchParams.get("confirm");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=. Check SETUP_SECRET in your Vercel env vars." }, { status: 401 });
  }
  if (confirm !== "yes-reset-attempts-and-mastery") {
    return NextResponse.json(
      {
        error:
          "This resets (deletes) all attempts and mastery data. Re-run with &confirm=yes-reset-attempts-and-mastery to proceed.",
      },
      { status: 400 }
    );
  }

  const log = [];
  let hadError = false;

  try {
    await db
      .insert(subjects)
      .values({
        id: "law-optional",
        displayName: "Law Optional",
        category: "optional",
        examStage: "mains",
        answerFormat: "descriptive",
      })
      .onConflictDoNothing({ target: subjects.id });
    log.push("OK  seed:subjects (law-optional)");
  } catch (err) {
    hadError = true;
    log.push(`FAIL seed:subjects -- ${err.message}`);
  }

  try {
    const result = await db
      .update(subtopics)
      .set({ subjectId: "law-optional" })
      .where(isNull(subtopics.subjectId))
      .returning({ id: subtopics.id });
    log.push(`OK  backfill:subtopics.subjectId (${result.length} rows)`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL backfill:subtopics.subjectId -- ${err.message}`);
  }

  try {
    const result = await db
      .update(pyqs)
      .set({ subjectId: "law-optional" })
      .where(isNull(pyqs.subjectId))
      .returning({ id: pyqs.id });
    log.push(`OK  backfill:pyqs.subjectId (${result.length} rows)`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL backfill:pyqs.subjectId -- ${err.message}`);
  }

  try {
    const [{ count: attemptsBefore }] = await db.execute(sql`select count(*)::int as count from attempts`);
    await db.execute(sql`truncate table attempts restart identity`);
    log.push(`OK  reset:attempts (deleted ${attemptsBefore} rows)`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL reset:attempts -- ${err.message}`);
  }

  try {
    const [{ count: masteryBefore }] = await db.execute(sql`select count(*)::int as count from mastery`);
    await db.execute(sql`truncate table mastery`);
    log.push(`OK  reset:mastery (deleted ${masteryBefore} rows)`);
  } catch (err) {
    hadError = true;
    log.push(`FAIL reset:mastery -- ${err.message}`);
  }

  return NextResponse.json(
    {
      status: hadError ? "partial" : "ok",
      log,
      next: hadError
        ? "One or more steps failed -- read the FAIL lines above."
        : "Phase 1 data reset complete. Auth (PR4) is required before mastery/attempts get repopulated per-user.",
    },
    { status: hadError ? 207 : 200 }
  );
}
