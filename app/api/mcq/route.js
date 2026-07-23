// app/api/mcq/route.js
//
// GET  -> the next Prelims-style MCQ, drawn from a random subtopic among
//      this user's unlocked GS + optional subjects (see
//      lib/adaptive/subjectUnlockState.js) -- CSAT isn't covered here, it's
//      an aptitude/reasoning test with no subtopic content to draw from,
//      out of scope for this piece. Options are returned but the correct
//      answer is NOT -- that only comes back from POST, after grading.
// POST { subtopicId, questionRefId, selectedIndex } -> deterministic
//      grading (no AI call needed, unlike descriptive answers) + records the
//      attempt. Deliberately separate from app/api/attempt/route.js's
//      questionSource:'pyq'|'model' descriptive flow and does NOT touch
//      mastery/currentTier/moduleProgress -- MCQ accuracy is tracked
//      independently (see stats below, computed on the fly from `attempts`
//      rather than a new running counter) so it can never distort the
//      descriptive-mastery-gated subject/subtopic/module unlock system.
import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, sources, subjects, attempts, modelQuestions } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../lib/subjects/config.js";
import { sortByTierPriority } from "../../../lib/sources/tiers.js";
import { generateMcq } from "../../../lib/ai/generateMcq.js";
import { loadUnlockedSubjectIds, isSubjectUnlocked } from "../../../lib/adaptive/subjectUnlockState.js";

const MCQ_DIFFICULTY_TIER = 2; // flat -- no adaptive tiering for MCQ mode (see file header)
const MCQ_MARKS = 2; // standard real UPSC Prelims MCQ weight

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
    const unlockedSubjectIds = optionalSubjectId ? [...unlockedGsIds, optionalSubjectId] : unlockedGsIds;
    if (!unlockedSubjectIds.length) {
      return NextResponse.json({ error: "onboarding_not_complete" }, { status: 409 });
    }

    const pool = await db.select().from(subtopics).where(inArray(subtopics.subjectId, unlockedSubjectIds));
    if (!pool.length) {
      return NextResponse.json({ error: "No subtopics with content in your unlocked subjects yet." }, { status: 404 });
    }

    // Spread coverage rather than pure random -- prefer whichever unlocked
    // subtopic this user has answered the fewest MCQs on so far (ties broken
    // randomly), so a small pool doesn't get dominated by repeats of one topic.
    const attemptCounts = await db
      .select({ subtopicId: attempts.subtopicId, count: sql`count(*)`.mapWith(Number) })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.questionSource, "mcq"), inArray(attempts.subtopicId, pool.map((s) => s.id))))
      .groupBy(attempts.subtopicId);
    const countBySubtopic = Object.fromEntries(attemptCounts.map((r) => [r.subtopicId, r.count]));
    const minCount = Math.min(...pool.map((s) => countBySubtopic[s.id] ?? 0));
    const leastAttempted = pool.filter((s) => (countBySubtopic[s.id] ?? 0) === minCount);
    const subtopicRow = leastAttempted[Math.floor(Math.random() * leastAttempted.length)];

    // Prefer a cached MCQ this user hasn't seen yet over always generating fresh.
    const cachedRows = await db
      .select()
      .from(modelQuestions)
      .where(and(eq(modelQuestions.subtopicId, subtopicRow.id), eq(modelQuestions.format, "mcq")));
    let questionRow;
    if (cachedRows.length) {
      const seenRows = await db
        .select({ id: attempts.questionRefId })
        .from(attempts)
        .where(and(eq(attempts.userId, userId), eq(attempts.subtopicId, subtopicRow.id), eq(attempts.questionSource, "mcq")));
      const seen = new Set(seenRows.map((r) => String(r.id)));
      questionRow = cachedRows.find((q) => !seen.has(String(q.id)));
    }

    if (!questionRow) {
      const srcRows = await db.select().from(sources).where(eq(sources.subtopicId, subtopicRow.id));
      const sourceExcerpts = sortByTierPriority(srcRows.filter((s) => s.extractedText))
        .map((s) => s.extractedText)
        .slice(0, 2);
      const generated = await generateMcq({
        subtopicText: subtopicRow.topicText,
        sourceExcerpts,
        subjectConfig: getSubjectConfig(subtopicRow.subjectId),
      });
      [questionRow] = await db
        .insert(modelQuestions)
        .values({
          subtopicId: subtopicRow.id,
          difficultyTier: MCQ_DIFFICULTY_TIER,
          marks: MCQ_MARKS,
          questionText: generated.questionText,
          format: "mcq",
          options: generated.options,
          correctIndex: generated.correctIndex,
          explanation: generated.explanation,
        })
        .returning();
    }

    return NextResponse.json({
      subtopicId: subtopicRow.id,
      subtopicText: subtopicRow.topicText,
      questionRefId: String(questionRow.id),
      questionText: questionRow.questionText,
      options: questionRow.options,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { subtopicId, questionRefId, selectedIndex } = await request.json();
    if (!subtopicId || !questionRefId || !Number.isInteger(selectedIndex)) {
      return NextResponse.json({ error: "subtopicId, questionRefId, and a numeric selectedIndex are required" }, { status: 400 });
    }

    const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    const subtopicRow = subtopicRows[0];
    if (!subtopicRow) return NextResponse.json({ error: "Unknown subtopic" }, { status: 404 });

    if (!(await isSubjectUnlocked(userId, subtopicRow.subjectId))) {
      return NextResponse.json({ error: "subject_locked" }, { status: 403 });
    }

    const questionRows = await db.select().from(modelQuestions).where(eq(modelQuestions.id, Number(questionRefId)));
    const questionRow = questionRows[0];
    if (!questionRow || questionRow.format !== "mcq" || questionRow.subtopicId !== subtopicId) {
      return NextResponse.json({ error: "Unknown MCQ" }, { status: 404 });
    }

    const correct = selectedIndex === questionRow.correctIndex;
    await db.insert(attempts).values({
      userId,
      subtopicId,
      questionSource: "mcq",
      questionRefId: String(questionRow.id),
      questionTextSnapshot: questionRow.questionText,
      difficultyTier: questionRow.difficultyTier,
      marks: questionRow.marks,
      answerText: questionRow.options[selectedIndex] ?? "",
      score: correct ? 100 : 0,
      feedback: { selectedIndex, correctIndex: questionRow.correctIndex, explanation: questionRow.explanation, correct },
    });

    const statsRows = await db
      .select({ score: attempts.score })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.questionSource, "mcq")));
    const stats = { attempted: statsRows.length, correct: statsRows.filter((r) => r.score === 100).length };

    return NextResponse.json({ correct, correctIndex: questionRow.correctIndex, explanation: questionRow.explanation, stats });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
