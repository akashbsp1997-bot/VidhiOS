// app/api/readiness/route.js
//
// GET -> the readiness dashboard: a study streak, a weak-area heatmap
// across every unlocked (subjectId, section) bucket, and descriptive/MCQ/
// mock-test performance side by side. Everything here is aggregated from
// data already tracked elsewhere (attempts, mastery, mock_tests) -- no new
// tracking, no AI calls, and deliberately NO single blended "readiness
// score" (see lib/adaptive/readiness.js's header comment for why).
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, mastery, attempts, mockTests, subjects } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { loadUnlockedSubjectIds } from "../../../lib/adaptive/subjectUnlockState.js";
import { computeStreak } from "../../../lib/adaptive/readiness.js";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
    const unlockedSubjectIds = optionalSubjectId ? [...unlockedGsIds, optionalSubjectId] : unlockedGsIds;
    if (!unlockedSubjectIds.length) {
      return NextResponse.json({ error: "onboarding_not_complete" }, { status: 409 });
    }

    const subjectRows = await db.select({ id: subjects.id, displayName: subjects.displayName }).from(subjects).where(inArray(subjects.id, unlockedSubjectIds));
    const subjectById = Object.fromEntries(subjectRows.map((s) => [s.id, s]));

    const subtopicRows = await db.select().from(subtopics).where(inArray(subtopics.subjectId, unlockedSubjectIds));
    const ids = subtopicRows.map((s) => s.id);

    const masteryRows = await db.select().from(mastery).where(eq(mastery.userId, userId));
    const masteryBySubtopic = Object.fromEntries(masteryRows.map((m) => [m.subtopicId, m]));

    // Heatmap buckets keyed by (subjectId, section) -- a plain `section`
    // key alone risks colliding two unrelated subjects that happen to reuse
    // a section name, so this uses the same composite-key convention as
    // app/api/subtopics/route.js's per-paper grouping.
    const buckets = {};
    for (const s of subtopicRows) {
      const key = `${s.subjectId}::${s.section}`;
      (buckets[key] ??= { subjectId: s.subjectId, section: s.section, subtopicIds: [] }).subtopicIds.push(s.id);
    }
    const heatmap = Object.values(buckets)
      .map((b) => {
        const scores = b.subtopicIds.map((id) => masteryBySubtopic[id]?.masteryScore ?? 0);
        const avgMastery = scores.reduce((sum, v) => sum + v, 0) / scores.length;
        const attemptsCount = b.subtopicIds.reduce((sum, id) => sum + (masteryBySubtopic[id]?.attemptsCount ?? 0), 0);
        return {
          subjectId: b.subjectId,
          subjectDisplayName: subjectById[b.subjectId]?.displayName ?? b.subjectId,
          section: b.section,
          subtopicCount: b.subtopicIds.length,
          avgMastery,
          attemptsCount,
        };
      })
      .sort((a, b) => a.avgMastery - b.avgMastery);

    const overallMastery = ids.length
      ? heatmap.reduce((sum, b) => sum + b.avgMastery * b.subtopicCount, 0) / heatmap.reduce((sum, b) => sum + b.subtopicCount, 0)
      : 0;

    const allAttempts = ids.length
      ? await db
          .select({ createdAt: attempts.createdAt, questionSource: attempts.questionSource, score: attempts.score })
          .from(attempts)
          .where(and(eq(attempts.userId, userId), inArray(attempts.subtopicId, ids)))
      : [];
    const mockRows = await db
      .select({ subjectId: mockTests.subjectId, size: mockTests.size, totalScore: mockTests.totalScore, totalMarks: mockTests.totalMarks, submittedAt: mockTests.submittedAt })
      .from(mockTests)
      .where(eq(mockTests.userId, userId));
    const submittedMocks = mockRows.filter((m) => m.submittedAt);

    const activityDates = [
      ...allAttempts.map((a) => a.createdAt.toISOString().slice(0, 10)),
      ...submittedMocks.map((m) => m.submittedAt.toISOString().slice(0, 10)),
    ];
    const todayStr = new Date().toISOString().slice(0, 10);
    const streak = computeStreak(activityDates, todayStr);

    const descriptiveAttempts = allAttempts.filter((a) => a.questionSource !== "mcq");
    const mcqAttempts = allAttempts.filter((a) => a.questionSource === "mcq");

    return NextResponse.json({
      overallMastery,
      totalSubtopics: ids.length,
      streak: { ...streak, daysActive: new Set(activityDates).size },
      descriptive: {
        attempted: descriptiveAttempts.length,
        avgScore: descriptiveAttempts.length ? Math.round(descriptiveAttempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / descriptiveAttempts.length) : null,
      },
      mcq: { attempted: mcqAttempts.length, correct: mcqAttempts.filter((a) => a.score === 100).length },
      mockTests: {
        count: submittedMocks.length,
        avgPct: submittedMocks.length
          ? Math.round((submittedMocks.reduce((sum, m) => sum + (m.totalMarks ? m.totalScore / m.totalMarks : 0), 0) / submittedMocks.length) * 100)
          : null,
        recent: submittedMocks
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
          .slice(0, 5)
          .map((m) => ({
            subjectDisplayName: subjectById[m.subjectId]?.displayName ?? m.subjectId,
            size: m.size,
            totalScore: m.totalScore,
            totalMarks: m.totalMarks,
            submittedAt: m.submittedAt,
          })),
      },
      heatmap,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
