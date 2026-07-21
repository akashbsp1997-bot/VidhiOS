// app/api/attempt/route.js
//
// GET  ?subtopicId=CA1 (optional) -> the next question to answer. Omit
//      subtopicId for full adaptive mode (engine picks the subtopic too).
// POST { subtopicId, questionSource, questionRefId, questionTextSnapshot,
//        difficultyTier, marks, answerText } -> grades the answer, records
//      the attempt, updates mastery + tier. Does NOT return the next
//      question — call GET again (keeps the two concerns separate; see
//      docs/ARCHITECTURE.md).

// Explicit, not left at the platform default -- both branches make at most
// one AI call each (generateQuestion or gradeAnswer), each individually
// bounded by lib/ai/client.js's 45s timeout; 90s leaves headroom above that
// for the DB work either side without assuming the account's actual default
// ceiling is high enough (this project has needed to raise it explicitly
// before -- see app/api/lesson/route.js's history).
export const maxDuration = 90;

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, mastery, pyqs, modelQuestions, attempts, sources, lessonModules } from "../../../db/schema.js";
import { chooseSubtopic, chooseQuestionPlan, updateMastery, nextTier, pushRecentScore } from "../../../lib/adaptive/engine.js";
import { gradeAnswer } from "../../../lib/ai/grade.js";
import { generateQuestion } from "../../../lib/ai/generateQuestion.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../lib/subjects/config.js";
import { sortByTierPriority } from "../../../lib/sources/tiers.js";

// A module-level Test (components/ModuleTestPanel.jsx) always wants exactly
// its one cached question for a known subtopic+module, never the adaptive
// engine's subtopic-choosing/pyq-vs-model-mix logic -- real PYQs can't be
// narrowed to a module (they're fixed historical exam text), and there's
// only ever one question to reuse per module, not a pool to rotate through.
// This short-circuits GET entirely, mirroring how `forcedSubtopicId` already
// short-circuits chooseSubtopic below, one level narrower.
async function handleModuleQuestion(userId, subtopicId, moduleId) {
  const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
  const subtopicRow = subtopicRows[0];
  if (!subtopicRow) return NextResponse.json({ error: `Unknown subtopic: ${subtopicId}` }, { status: 404 });

  const moduleRows = await db.select().from(lessonModules).where(eq(lessonModules.id, moduleId));
  const moduleRow = moduleRows[0];
  if (!moduleRow || moduleRow.subtopicId !== subtopicId) {
    return NextResponse.json({ error: `Unknown module ${moduleId} for subtopic ${subtopicId}` }, { status: 404 });
  }

  const masteryRows = await db.select().from(mastery).where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
  const tier = masteryRows[0]?.currentTier ?? 1;

  const cachedRows = await db
    .select()
    .from(modelQuestions)
    .where(and(eq(modelQuestions.subtopicId, subtopicId), eq(modelQuestions.moduleId, moduleId)));

  let questionRow = cachedRows[0];
  if (!questionRow) {
    const generated = await generateQuestion({
      subtopicText: subtopicRow.topicText,
      difficultyTier: tier,
      moduleScope: { title: moduleRow.title, scopeNote: moduleRow.scopeNote },
      subjectConfig: getSubjectConfig(subtopicRow.subjectId),
    });
    [questionRow] = await db
      .insert(modelQuestions)
      .values({
        subtopicId,
        moduleId,
        difficultyTier: tier,
        marks: generated.marks,
        questionText: generated.questionText,
      })
      .returning();
  }

  return NextResponse.json({
    subtopicId,
    subtopicText: subtopicRow.topicText,
    moduleId,
    tier,
    questionSource: "model",
    questionRefId: String(questionRow.id),
    questionText: questionRow.questionText,
    marks: questionRow.marks,
  });
}

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const forcedSubtopicId = searchParams.get("subtopicId") || undefined;
  const moduleIdParam = searchParams.get("moduleId");

  try {
    if (moduleIdParam) {
      if (!forcedSubtopicId) return NextResponse.json({ error: "subtopicId is required alongside moduleId" }, { status: 400 });
      return await handleModuleQuestion(userId, forcedSubtopicId, Number(moduleIdParam));
    }

    const allSubtopics = await db.select().from(subtopics);
    if (!allSubtopics.length) {
      return NextResponse.json(
        { error: "No subtopics found. Run `npm run seed` after your first `drizzle-kit push` — see README." },
        { status: 404 }
      );
    }
    const allMastery = await db.select().from(mastery).where(eq(mastery.userId, userId));
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
      .where(and(eq(attempts.subtopicId, subtopicId), eq(attempts.userId, userId)));
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
      const sourceExcerpts = sortByTierPriority(srcRows.filter((s) => s.extractedText))
        .map((s) => s.extractedText)
        .slice(0, 2);

      const generated = await generateQuestion({
        subtopicText: subtopicRow.topicText,
        difficultyTier: plan.difficultyTier,
        sourceExcerpts,
        subjectConfig: getSubjectConfig(subtopicRow.subjectId),
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
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const body = await request.json();
    const { subtopicId, questionSource, questionRefId, questionTextSnapshot, difficultyTier, marks, answerText, moduleId } = body || {};

    if (!subtopicId || !questionRefId || !questionTextSnapshot || typeof answerText !== "string") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    const subtopicRow = subtopicRows[0];
    if (!subtopicRow) return NextResponse.json({ error: "Unknown subtopic" }, { status: 404 });

    // Grading uses a more specific subtopicText for a module-level attempt --
    // gradeAnswer's own signature is unchanged, this is just a richer string
    // passed through its existing subtopicText param (see lib/ai/grade.js).
    let subtopicTextForGrading = subtopicRow.topicText;
    if (moduleId) {
      const moduleRows = await db.select().from(lessonModules).where(eq(lessonModules.id, moduleId));
      const moduleRow = moduleRows[0];
      if (moduleRow) {
        subtopicTextForGrading = `${subtopicRow.topicText} — module focus: "${moduleRow.title}" (${moduleRow.scopeNote})`;
      }
    }

    const feedback = await gradeAnswer({
      questionText: questionTextSnapshot,
      marks: marks || 15,
      subtopicText: subtopicTextForGrading,
      answerText,
      subjectConfig: getSubjectConfig(subtopicRow.subjectId),
    });

    await db.insert(attempts).values({
      userId,
      subtopicId,
      questionSource: questionSource || "pyq",
      questionRefId: String(questionRefId),
      questionTextSnapshot,
      difficultyTier: difficultyTier || 1,
      marks: marks || 15,
      answerText,
      score: feedback.score,
      feedback,
      moduleId: moduleId || null,
    });

    const existingRows = await db
      .select()
      .from(mastery)
      .where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
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
        .where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
    } else {
      await db.insert(mastery).values({
        userId,
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
