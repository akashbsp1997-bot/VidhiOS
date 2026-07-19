// app/api/attempt/route.js
//
// GET  ?subtopicId=CA1 (optional) -> the next question to answer. Omit
//      subtopicId for full adaptive mode (engine picks the subtopic too).
// POST { subtopicId, questionSource, questionRefId, questionTextSnapshot,
//        difficultyTier, marks, answerText } -> grades the answer, records
//      the attempt, updates mastery + tier. Does NOT return the next
//      question — call GET again (keeps the two concerns separate; see
//      docs/ARCHITECTURE.md).

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, mastery, pyqs, modelQuestions, attempts, sources } from "../../../db/schema.js";
import { chooseSubtopic, chooseQuestionPlan, updateMastery, nextTier, pushRecentScore } from "../../../lib/adaptive/engine.js";
import { gradeAnswer } from "../../../lib/ai/grade.js";
import { generateQuestion } from "../../../lib/ai/generateQuestion.js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const forcedSubtopicId = searchParams.get("subtopicId") || undefined;

  try {
    const allSubtopics = await db.select().from(subtopics);
    if (!allSubtopics.length) {
      return NextResponse.json(
        { error: "No subtopics found. Run `npm run seed` after your first `drizzle-kit push` — see README." },
        { status: 404 }
      );
    }
    const allMastery = await db.select().from(mastery);
    const masteryBySubtopic = Object.fromEntries(allMastery.map((m) => [m.subtopicId, m]));

    const subtopicStates = allSubtopics.map((s) => ({
      id: s.id,
      mastery: masteryBySubtopic[s.id]?.masteryScore ?? 0,
      pyqFrequency: s.pyqFrequency,
    }));

    const subtopicId = forcedSubtopicId || chooseSubtopic(subtopicStates);
    const subtopicRow = allSubtopics.find((s) => s.id === subtopicId);
    if (!subtopicRow) {
      return NextResponse.json({ error: `Unknown subtopic: ${subtopicId}` }, { status: 404 });
    }
    const tier = masteryBySubtopic[subtopicId]?.currentTier ?? 1;

    const pyqPool = await db.select().from(pyqs).where(sql`${subtopicId} = ANY(${pyqs.topics})`);
    const modelPool = await db.select().from(modelQuestions).where(eq(modelQuestions.subtopicId, subtopicId));
    const seenRows = await db
      .select({ id: attempts.questionRefId })
      .from(attempts)
      .where(eq(attempts.subtopicId, subtopicId));
    const seenQuestionRefIds = seenRows.map((r) => r.id);

    const plan = chooseQuestionPlan({ tier, seenQuestionRefIds, pyqPool, modelPool });

    let questionText, marks, questionRefId;
    let questionSource = plan.source;

    if (plan.source === "pyq") {
      const q = pyqPool.find((p) => p.id === plan.id);
      if (!q) return NextResponse.json({ error: "Planned PYQ vanished — try again" }, { status: 500 });
      questionText = q.questionText;
      marks = q.marks;
      questionRefId = q.id;
    } else if (plan.source === "model") {
      const q = modelPool.find((m) => String(m.id) === String(plan.id));
      if (!q) return NextResponse.json({ error: "Planned model question vanished — try again" }, { status: 500 });
      questionText = q.questionText;
      marks = q.marks;
      questionRefId = String(q.id);
    } else {
      // generate: ground in whatever cached source text this subtopic has, if any
      const srcRows = await db.select().from(sources).where(eq(sources.subtopicId, subtopicId));
      const sourceExcerpts = srcRows.filter((s) => s.extractedText).map((s) => s.extractedText).slice(0, 2);

      const generated = await generateQuestion({
        subtopicText: subtopicRow.topicText,
        difficultyTier: plan.difficultyTier,
        sourceExcerpts,
      });
      const [inserted] = await db
        .insert(modelQuestions)
        .values({
          subtopicId,
          difficultyTier: plan.difficultyTier,
          marks: generated.marks,
          questionText: generated.questionText,
        })
        .returning();
      questionText = inserted.questionText;
      marks = inserted.marks;
      questionRefId = String(inserted.id);
      questionSource = "model";
    }

    return NextResponse.json({
      subtopicId,
      subtopicText: subtopicRow.topicText,
      tier,
      questionSource,
      questionRefId,
      questionText,
      marks,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { subtopicId, questionSource, questionRefId, questionTextSnapshot, difficultyTier, marks, answerText } = body || {};

    if (!subtopicId || !questionRefId || !questionTextSnapshot || typeof answerText !== "string") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    const subtopicRow = subtopicRows[0];
    if (!subtopicRow) return NextResponse.json({ error: "Unknown subtopic" }, { status: 404 });

    const feedback = await gradeAnswer({
      questionText: questionTextSnapshot,
      marks: marks || 15,
      subtopicText: subtopicRow.topicText,
      answerText,
    });

    await db.insert(attempts).values({
      subtopicId,
      questionSource: questionSource || "pyq",
      questionRefId: String(questionRefId),
      questionTextSnapshot,
      difficultyTier: difficultyTier || 1,
      marks: marks || 15,
      answerText,
      score: feedback.score,
      feedback,
    });

    const existingRows = await db.select().from(mastery).where(eq(mastery.subtopicId, subtopicId));
    const existing = existingRows[0];
    const attemptsSoFar = existing?.attemptsCount ?? 0;
    const oldMastery = existing?.masteryScore ?? 0;
    const score01 = feedback.score / 100;
    const newMasteryScore = updateMastery(oldMastery, attemptsSoFar, score01);
    const recentScores = pushRecentScore(existing?.recentScores ?? [], score01);
    const newTier = nextTier(existing?.currentTier ?? 1, recentScores);

    if (existing) {
      await db
        .update(mastery)
        .set({
          masteryScore: newMasteryScore,
          attemptsCount: attemptsSoFar + 1,
          currentTier: newTier,
          recentScores,
          lastAttemptAt: new Date(),
        })
        .where(eq(mastery.subtopicId, subtopicId));
    } else {
      await db.insert(mastery).values({
        subtopicId,
        masteryScore: newMasteryScore,
        attemptsCount: 1,
        currentTier: newTier,
        recentScores,
        lastAttemptAt: new Date(),
      });
    }

    return NextResponse.json({
      feedback,
      mastery: { score: newMasteryScore, tier: newTier, attemptsCount: attemptsSoFar + 1 },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
