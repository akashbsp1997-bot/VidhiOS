// app/api/answer-architect/route.js
//
// GET  -> a random "keep the right bullets" round: a real practice question
//      (lessonModules.exercises[].prompt) plus a shuffled mix of its real
//      model-answer bullets and a few distractor bullets pulled from an
//      unrelated exercise, correct/distractor tags withheld (same
//      withholding pattern app/api/mcq/route.js uses for correctIndex).
// POST { answerKeyRef, keptBulletIds } -> re-derives the correct/distractor
//      sets deterministically from the DB (no stored session state) and
//      scores the round.
//
// Reuses content already generated once for regular module practice --
// zero AI calls either way, unlike the rest of this app's practice modes
// (see the 2026-07-24 overnight-batch-grading change, which this composes
// with: less AI load overall, not more).

import { NextResponse } from "next/server";
import { sql, inArray } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { lessonModules } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { unlockedSubjectChecker, subjectIdBySubtopicId } from "../../../lib/adaptive/unlockedContentPool.js";
import { bulletLines } from "../../../lib/text/bullets.js";
import { recordMissionSafe } from "../../../lib/gamification/missions.js";
import { shuffled } from "../../../lib/utils/shuffle.js";

const MAX_CORRECT_BULLETS = 5;
const DISTRACTOR_COUNT = 3;

// Every (moduleId, exerciseIndex) pair across every unlocked-for-this-user
// module that has at least one usable bullet in its modelAnswer.
async function eligibleExercises(userId) {
  const candidateModules = await db
    .select({ id: lessonModules.id, subtopicId: lessonModules.subtopicId, exercises: lessonModules.exercises })
    .from(lessonModules)
    .where(sql`jsonb_array_length(${lessonModules.exercises}) > 0`);
  if (!candidateModules.length) return [];

  const subtopicIds = [...new Set(candidateModules.map((m) => m.subtopicId))];
  const subjectBySubtopic = await subjectIdBySubtopicId(subtopicIds);
  const isUnlocked = await unlockedSubjectChecker(userId);

  const out = [];
  for (const m of candidateModules) {
    if (!isUnlocked(subjectBySubtopic[m.subtopicId])) continue;
    (m.exercises || []).forEach((ex, exerciseIndex) => {
      if (bulletLines(ex.modelAnswer || "").length > 0) out.push({ moduleId: m.id, exerciseIndex, prompt: ex.prompt, modelAnswer: ex.modelAnswer });
    });
  }
  return out;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const pool = await eligibleExercises(userId);
    if (pool.length < 2) {
      return NextResponse.json({ error: "Not enough practice content generated yet to play this — try again after doing some regular practice first." }, { status: 404 });
    }

    const correct = pool[Math.floor(Math.random() * pool.length)];
    let distractorPool = pool.filter((e) => e.moduleId !== correct.moduleId || e.exerciseIndex !== correct.exerciseIndex);
    if (!distractorPool.length) distractorPool = pool;
    const distractor = distractorPool[Math.floor(Math.random() * distractorPool.length)];

    const correctBullets = bulletLines(correct.modelAnswer).slice(0, MAX_CORRECT_BULLETS);
    const distractorBullets = bulletLines(distractor.modelAnswer).slice(0, DISTRACTOR_COUNT);

    const bullets = shuffled([
      ...correctBullets.map((text, i) => ({ id: `c${i}`, text })),
      ...distractorBullets.map((text, i) => ({ id: `d${i}`, text })),
    ]);

    return NextResponse.json({
      questionText: correct.prompt,
      bullets,
      answerKeyRef: {
        moduleId: correct.moduleId,
        exerciseIndex: correct.exerciseIndex,
        distractorModuleId: distractor.moduleId,
        distractorExerciseIndex: distractor.exerciseIndex,
      },
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
    const { answerKeyRef, keptBulletIds } = await request.json();
    const { moduleId, exerciseIndex, distractorModuleId, distractorExerciseIndex } = answerKeyRef || {};
    if (!moduleId || exerciseIndex == null || !distractorModuleId || distractorExerciseIndex == null || !Array.isArray(keptBulletIds)) {
      return NextResponse.json({ error: "answerKeyRef and keptBulletIds are required" }, { status: 400 });
    }

    const rows = await db.select().from(lessonModules).where(inArray(lessonModules.id, [moduleId, distractorModuleId]));
    const correctModule = rows.find((r) => r.id === moduleId);
    const distractorModule = rows.find((r) => r.id === distractorModuleId);
    if (!correctModule || !distractorModule) return NextResponse.json({ error: "Unknown module in answerKeyRef" }, { status: 404 });

    const correctExercise = correctModule.exercises?.[exerciseIndex];
    const distractorExercise = distractorModule.exercises?.[distractorExerciseIndex];
    if (!correctExercise || !distractorExercise) return NextResponse.json({ error: "Unknown exercise in answerKeyRef" }, { status: 404 });

    const correctBullets = bulletLines(correctExercise.modelAnswer).slice(0, MAX_CORRECT_BULLETS);
    const distractorBullets = bulletLines(distractorExercise.modelAnswer).slice(0, DISTRACTOR_COUNT);
    const correctIds = correctBullets.map((_, i) => `c${i}`);
    const distractorIds = distractorBullets.map((_, i) => `d${i}`);

    const kept = new Set(keptBulletIds);
    let right = 0;
    for (const id of correctIds) if (kept.has(id)) right++; // should have been kept
    for (const id of distractorIds) if (!kept.has(id)) right++; // should have been discarded
    const total = correctIds.length + distractorIds.length;
    const score = total > 0 ? Math.round((right / total) * 100) : 0;

    // A drill, not a graded attempt -- writes nothing to attempts/mastery
    // (same "separate signal" treatment as MCQ/Quant Puzzle Chain/Essay
    // Tournament, see those routes' own schema comments), but still counts
    // toward today's "practice" mission like any other practice format.
    const practiceMission = await recordMissionSafe(userId, "practice");

    return NextResponse.json({ score, correctIds, distractorIds, missionRewards: [practiceMission].filter((m) => m?.newlyCompleted).map((m) => m.item) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
