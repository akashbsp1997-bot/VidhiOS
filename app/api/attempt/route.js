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
import { subtopics, mastery, pyqs, modelQuestions, attempts, sources, lessonModules, subjects } from "../../../db/schema.js";
import { chooseSubtopic, chooseQuestionPlan, updateMastery, nextTier, tierEscalationBlockedInfo, pushRecentScore } from "../../../lib/adaptive/engine.js";
import { gradeAnswer } from "../../../lib/ai/grade.js";
import { generateQuestion } from "../../../lib/ai/generateQuestion.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../lib/subjects/config.js";
import { sortByTierPriority } from "../../../lib/sources/tiers.js";
import { loadPaperLockMap } from "../../../lib/adaptive/lockState.js";
import { computeModuleLocks, isStageUnlocked } from "../../../lib/adaptive/unlocks.js";
import { isSubjectUnlocked, loadUnlockedSubjectIds } from "../../../lib/adaptive/subjectUnlockState.js";
import { isGatedCategory } from "../../../lib/adaptive/subjectUnlocks.js";

// A module-level Test (components/ModuleTestPanel.jsx) always wants exactly
// its one question for a known subtopic+module, never the adaptive engine's
// subtopic-choosing/pyq-vs-model-mix logic -- there's only ever one question
// to serve per module, not a pool to rotate through. This short-circuits GET
// entirely, mirroring how `forcedSubtopicId` already short-circuits
// chooseSubtopic below, one level narrower.
//
// A module built from a real PYQ (moduleRow.pyqId set -- see
// app/api/module-lesson/route.js's plan phase and lib/ai/generateModules.js's
// generateModulePlanFromPyqs) serves that EXACT real question directly, zero
// AI calls: the module's whole reason for existing is answering it, so there
// is no fabricated mapping here, unlike an AI-invented module (pyqId null)
// where a real PYQ genuinely wouldn't fit and the existing generate-and-cache
// path below still applies.
async function handleModuleQuestion(userId, subtopicId, moduleId, { force = false } = {}) {
  const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
  const subtopicRow = subtopicRows[0];
  if (!subtopicRow) return NextResponse.json({ error: `Unknown subtopic: ${subtopicId}` }, { status: 404 });

  const moduleRows = await db.select().from(lessonModules).where(eq(lessonModules.id, moduleId));
  const moduleRow = moduleRows[0];
  if (!moduleRow || moduleRow.subtopicId !== subtopicId) {
    return NextResponse.json({ error: `Unknown module ${moduleId} for subtopic ${subtopicId}` }, { status: 404 });
  }

  if (!(await isSubjectUnlocked(userId, subtopicRow.subjectId))) {
    return NextResponse.json({ error: "subject_locked" }, { status: 403 });
  }

  const lockMap = await loadPaperLockMap(userId, subtopicRow.subjectId, subtopicRow.paper);
  if (lockMap.get(subtopicId)?.locked) {
    return NextResponse.json({ error: "locked", ...lockMap.get(subtopicId) }, { status: 403 });
  }

  const masteryRows = await db.select().from(mastery).where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
  const masteryRow = masteryRows[0];
  const tier = masteryRow?.currentTier ?? 1;
  const moduleProgress = masteryRow?.moduleProgress ?? {};
  const subtopicMasteryScore = masteryRow?.masteryScore ?? 0;

  const allModules = await db
    .select({ id: lessonModules.id, orderIndex: lessonModules.orderIndex })
    .from(lessonModules)
    .where(eq(lessonModules.subtopicId, subtopicId));
  const moduleLocks = computeModuleLocks(
    [...allModules].sort((a, b) => a.orderIndex - b.orderIndex),
    moduleProgress,
    subtopicMasteryScore
  );
  if (moduleLocks.get(moduleId)?.locked) {
    return NextResponse.json({ error: "module_locked", ...moduleLocks.get(moduleId) }, { status: 403 });
  }

  const unlockedStage = moduleProgress[String(moduleId)]?.highestStage ?? "teach";
  if (!isStageUnlocked("test", unlockedStage)) {
    return NextResponse.json({ error: "stage_locked", requiredStage: unlockedStage }, { status: 403 });
  }

  if (moduleRow.pyqId) {
    const pyqRows = await db.select().from(pyqs).where(eq(pyqs.id, moduleRow.pyqId));
    const pyq = pyqRows[0];
    if (!pyq) return NextResponse.json({ error: `Module ${moduleId}'s anchor PYQ ${moduleRow.pyqId} not found` }, { status: 500 });
    return NextResponse.json({
      subtopicId,
      subtopicText: subtopicRow.topicText,
      moduleId,
      tier,
      questionSource: "pyq",
      questionRefId: pyq.id,
      questionText: pyq.questionText,
      marks: pyq.marks,
    });
  }

  // force=true is the AI-invented-module retry mechanism (see
  // components/ModuleTestPanel.jsx's "Retry this test"): a PYQ-anchored
  // module's question is fixed real text, so retry there is a pure
  // client-side state reset (handled above, this branch never sees it) --
  // but an AI-invented module has no "harder version" of one fixed question,
  // so a genuine retry means generating a fresh one instead of reusing the
  // cache. Without `force`, prefer a cached row this user hasn't already
  // attempted, over always reusing the very first one ever generated.
  let questionRow;
  if (!force) {
    const cachedRows = await db
      .select()
      .from(modelQuestions)
      .where(and(eq(modelQuestions.subtopicId, subtopicId), eq(modelQuestions.moduleId, moduleId)));
    if (cachedRows.length) {
      const seenRows = await db
        .select({ id: attempts.questionRefId })
        .from(attempts)
        .where(and(eq(attempts.userId, userId), eq(attempts.moduleId, moduleId)));
      const seen = new Set(seenRows.map((r) => String(r.id)));
      questionRow = cachedRows.find((q) => !seen.has(String(q.id))) || cachedRows[0];
    }
  }

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
  const force = searchParams.get("force") === "true";

  try {
    if (moduleIdParam) {
      if (!forcedSubtopicId) return NextResponse.json({ error: "subtopicId is required alongside moduleId" }, { status: 400 });
      return await handleModuleQuestion(userId, forcedSubtopicId, Number(moduleIdParam), { force });
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

    // Direct-URL bypass check (e.g. /practice/{lockedSubtopicId}) -- a
    // locked subtopic must 403 here even though nothing in the UI would
    // normally link to it. Subject-level gate checked first (cheaper, and
    // logically prior -- a subtopic in a not-yet-unlocked subject has no
    // meaningful paper-lock state to report).
    if (forcedSubtopicId) {
      const forcedRow = allSubtopics.find((s) => s.id === forcedSubtopicId);
      if (forcedRow) {
        if (!(await isSubjectUnlocked(userId, forcedRow.subjectId))) {
          return NextResponse.json({ error: "subject_locked" }, { status: 403 });
        }
        const lockMap = await loadPaperLockMap(userId, forcedRow.subjectId, forcedRow.paper);
        if (lockMap.get(forcedSubtopicId)?.locked) {
          return NextResponse.json({ error: "locked", ...lockMap.get(forcedSubtopicId) }, { status: 403 });
        }
      }
    }

    // No forced subtopic: the adaptive lottery must never land on a locked
    // subtopic OR a subtopic whose whole subject isn't unlocked yet. Subject
    // gate first (one query for all this user's unlocked ids + one for
    // every subject's category, not per-subtopic), then the existing
    // per-(subjectId,paper) paper-lock pass.
    let eligibleSubtopics = allSubtopics;
    if (!forcedSubtopicId) {
      const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
      const allSubjectRows = await db.select({ id: subjects.id, category: subjects.category }).from(subjects);
      const categoryBySubject = Object.fromEntries(allSubjectRows.map((s) => [s.id, s.category]));
      const subjectUnlockedForUser = (subjectId) => {
        const category = categoryBySubject[subjectId];
        if (!isGatedCategory(category)) return true;
        return unlockedGsIds.includes(subjectId) || optionalSubjectId === subjectId;
      };

      const groups = {};
      for (const s of allSubtopics) {
        if (!subjectUnlockedForUser(s.subjectId)) continue;
        const key = `${s.subjectId}::${s.paper}`;
        (groups[key] ??= []).push(s);
      }
      const lockedIds = new Set();
      for (const key of Object.keys(groups)) {
        const [subjectId, paperStr] = key.split("::");
        const lockMap = await loadPaperLockMap(userId, subjectId, Number(paperStr));
        for (const [id, info] of lockMap.entries()) {
          if (info.locked) lockedIds.add(id);
        }
      }
      eligibleSubtopics = allSubtopics.filter((s) => subjectUnlockedForUser(s.subjectId) && !lockedIds.has(s.id));
    }

    const subtopicStates = eligibleSubtopics.map((s) => ({
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
    // Only set when this exact PYQ is also a module's anchor question (see
    // db/schema.js's lessonModules.pyqId) -- lets the client offer "study
    // this as a module" instead of just answering it cold. year/slot/sec/sub
    // are only meaningful for a real PYQ, hence undefined in the other
    // branches below.
    let pyqYear, pyqSlot, pyqSec, pyqSub, linkedModuleIndex;

    if (plan.source === "pyq") {
      const q = pyqPool.find((p) => p.id === plan.id);
      if (!q) return NextResponse.json({ error: "Planned PYQ vanished — try again" }, { status: 500 });
      questionText = q.questionText;
      marks = q.marks;
      questionRefId = q.id;
      pyqYear = q.year;
      pyqSlot = q.slot;
      pyqSec = q.sec;
      pyqSub = q.sub;

      const linkedRows = await db.select().from(lessonModules).where(eq(lessonModules.pyqId, q.id));
      linkedModuleIndex = linkedRows[0]?.orderIndex ?? null;
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
      pyqYear,
      pyqSlot,
      pyqSec,
      pyqSub,
      linkedModuleIndex,
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

    if (!(await isSubjectUnlocked(userId, subtopicRow.subjectId))) {
      return NextResponse.json({ error: "subject_locked" }, { status: 403 });
    }

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
    const oldTier = existing?.currentTier ?? 1;
    // Gated by the just-updated mastery score, not the pre-attempt one --
    // this attempt's own score is what may have just crossed the tier's
    // mastery floor (see lib/adaptive/engine.js's TIER_MASTERY_FLOOR).
    const newTier = nextTier(oldTier, recentScores, newMasteryScore);
    const tierHeldBack = tierEscalationBlockedInfo(oldTier, recentScores, newMasteryScore);

    const moduleProgress = { ...(existing?.moduleProgress ?? {}) };
    if (moduleId) {
      const key = String(moduleId);
      const prevEntry = moduleProgress[key] ?? {};
      moduleProgress[key] = {
        ...prevEntry,
        testAttempts: (prevEntry.testAttempts ?? 0) + 1,
        bestScore01: Math.max(prevEntry.bestScore01 ?? 0, score01),
      };
    }

    if (existing) {
      await db
        .update(mastery)
        .set({
          masteryScore: newMasteryScore,
          attemptsCount: attemptsSoFar + 1,
          currentTier: newTier,
          recentScores,
          lastAttemptAt: new Date(),
          moduleProgress,
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
        moduleProgress,
      });
    }

    return NextResponse.json({
      feedback,
      mastery: { score: newMasteryScore, tier: newTier, attemptsCount: attemptsSoFar + 1, tierHeldBack },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
