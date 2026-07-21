// app/api/subtopics/route.js
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, mastery, sources, subjects, pyqs } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";

// A subtopic's PYQ marks range 10-20 (see lib/ai/generateQuestion.js's
// allowedMarks) -- normalizes average marks onto the same 0-1 scale as
// sourceAdvancedness below, so the two signals can be averaged directly.
const MIN_PYQ_MARKS = 10;
const MAX_PYQ_MARKS = 20;

/**
 * Basics-to-advanced score (0 = most foundational, 1 = most advanced) for
 * ordering the dashboard within a paper (see app/page.jsx) -- combines two
 * independent signals per the user's explicit choice ("both, combined"):
 *   - source-tier composition: a subtopic grounded mainly in NCERT sources
 *     is foundational; one leaning on current-affairs/govt/external
 *     sources is advanced (same source-tier thinking as
 *     app/sources/[subtopicId]/page.jsx's grouping).
 *   - real PYQ marks: higher-mark UPSC questions tend to be more
 *     analytical/synthesis-level (see lib/ai/generateQuestion.js's
 *     TIER_BRIEF), lower-mark ones more direct-recall.
 * A subtopic missing one signal (no sources yet, or no real PYQs) falls
 * back to neutral (0.5) for that half rather than skewing the score on
 * absence of data.
 */
function difficultyScore(sourceBucket, pyqMarksList) {
  const sourceAdvancedness = sourceBucket && sourceBucket.total > 0 ? 1 - sourceBucket.ncert / sourceBucket.total : 0.5;
  const avgMarks = pyqMarksList && pyqMarksList.length ? pyqMarksList.reduce((a, b) => a + b, 0) / pyqMarksList.length : 15;
  const pyqAdvancedness = Math.min(1, Math.max(0, (avgMarks - MIN_PYQ_MARKS) / (MAX_PYQ_MARKS - MIN_PYQ_MARKS)));
  return (sourceAdvancedness + pyqAdvancedness) / 2;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const allSubtopics = await db.select().from(subtopics);
    const allMastery = await db.select().from(mastery).where(eq(mastery.userId, userId));
    const sourceCounts = await db
      .select({ subtopicId: sources.subtopicId, count: sql`count(*)`.mapWith(Number) })
      .from(sources)
      .groupBy(sources.subtopicId);
    const sourceRows = await db.select({ subtopicId: sources.subtopicId, sourceTier: sources.sourceTier }).from(sources);
    const allPyqs = await db.select({ topics: pyqs.topics, marks: pyqs.marks }).from(pyqs);
    const allSubjects = await db.select().from(subjects);

    const masteryBySubtopic = Object.fromEntries(allMastery.map((m) => [m.subtopicId, m]));
    const sourceCountBySubtopic = Object.fromEntries(sourceCounts.map((s) => [s.subtopicId, s.count]));
    const subjectById = Object.fromEntries(allSubjects.map((s) => [s.id, s]));

    const sourceTierBySubtopic = {}; // subtopicId -> { ncert, total }
    for (const row of sourceRows) {
      const bucket = (sourceTierBySubtopic[row.subtopicId] ??= { ncert: 0, total: 0 });
      bucket.total += 1;
      if (row.sourceTier === "ncert") bucket.ncert += 1;
    }

    const pyqMarksBySubtopic = {}; // subtopicId -> marks[] -- one pyq can tag multiple subtopics via topics[]
    for (const q of allPyqs) {
      for (const t of q.topics) {
        (pyqMarksBySubtopic[t] ??= []).push(q.marks);
      }
    }

    const result = allSubtopics
      .map((s) => ({
        id: s.id,
        subjectId: s.subjectId,
        subjectDisplayName: subjectById[s.subjectId]?.displayName ?? s.subjectId,
        paper: s.paper,
        section: s.section,
        topicText: s.topicText,
        pyqFrequency: s.pyqFrequency,
        masteryScore: masteryBySubtopic[s.id]?.masteryScore ?? 0,
        currentTier: masteryBySubtopic[s.id]?.currentTier ?? 1,
        attemptsCount: masteryBySubtopic[s.id]?.attemptsCount ?? 0,
        stage: masteryBySubtopic[s.id]?.stage ?? "teach",
        sourceCount: sourceCountBySubtopic[s.id] ?? 0,
        difficultyScore: difficultyScore(sourceTierBySubtopic[s.id], pyqMarksBySubtopic[s.id]),
      }))
      // Study-path order: paper first, then basics -> advanced within it,
      // pyqFrequency as a tie-breaker among similarly-difficulty subtopics
      // (surfaces higher-yield ones first) -- this is purely a dashboard
      // presentation order, unrelated to lib/adaptive/engine.js's separate
      // weighted-random subtopic selection for actual practice sessions.
      .sort(
        (a, b) =>
          a.paper - b.paper ||
          a.difficultyScore - b.difficultyScore ||
          b.pyqFrequency - a.pyqFrequency ||
          a.id.localeCompare(b.id)
      );

    return NextResponse.json({ subtopics: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
