// app/api/subtopics/route.js
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, mastery, sources, subjects, pyqs } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { computeDifficultyScore, orderSubtopicsWithinPaper, computeSubtopicLocks } from "../../../lib/adaptive/unlocks.js";

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

    const withScore = allSubtopics.map((s) => ({
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
      difficultyScore: computeDifficultyScore(sourceTierBySubtopic[s.id], pyqMarksBySubtopic[s.id]),
    }));

    // Study-path order: paper first, then basics -> advanced within it,
    // pyqFrequency as a tie-breaker among similarly-difficulty subtopics
    // (surfaces higher-yield ones first) -- this is purely a dashboard
    // presentation order, unrelated to lib/adaptive/engine.js's separate
    // weighted-random subtopic selection for actual practice sessions.
    // Grouped by (subjectId, paper) so each paper's chain-lock computation
    // (computeSubtopicLocks) only ever compares subtopics within the same
    // paper, matching lib/adaptive/lockState.js's server-side enforcement.
    const byPaperKey = {};
    for (const s of withScore) {
      const key = `${s.subjectId}::${s.paper}`;
      (byPaperKey[key] ??= []).push(s);
    }

    let result = [];
    for (const key of Object.keys(byPaperKey)) {
      const ordered = orderSubtopicsWithinPaper(byPaperKey[key]);
      const masteryScoreById = Object.fromEntries(ordered.map((s) => [s.id, s.masteryScore]));
      const locks = computeSubtopicLocks(ordered, masteryScoreById);
      result.push(...ordered.map((s) => ({ ...s, ...locks.get(s.id) })));
    }
    result.sort((a, b) => a.paper - b.paper || a.difficultyScore - b.difficultyScore || b.pyqFrequency - a.pyqFrequency || a.id.localeCompare(b.id));

    return NextResponse.json({ subtopics: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
