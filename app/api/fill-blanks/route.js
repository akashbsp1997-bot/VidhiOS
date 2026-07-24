// app/api/fill-blanks/route.js
//
// GET  -> a cloze round built from a module's already-generated Teach
//      content (lessonModules.teachContent, bullet-per-line -- see
//      lib/ai/generateModules.js's buildModuleTeachSystem): some of the
//      bullet lines are blanked out, ranging from just a couple of lines to
//      most of the passage (BLANK_FRACTIONS below), and the answer bank
//      mixes the blanked lines' real text with a couple of distractor lines
//      pulled from an unrelated module -- correct/distractor tags withheld,
//      same withholding pattern app/api/answer-architect/route.js uses.
// POST { answerKeyRef, assignments } -> re-derives the correct bank id for
//      each blank deterministically from the DB (no stored session state)
//      and scores the round.
//
// Reuses content already generated once for regular module practice --
// zero AI calls either way, same load-shedding intent as
// app/api/answer-architect/route.js (see the 2026-07-24
// overnight-batch-grading change).

import { NextResponse } from "next/server";
import { isNotNull, inArray } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { lessonModules } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { unlockedSubjectChecker, subjectIdBySubtopicId } from "../../../lib/adaptive/unlockedContentPool.js";
import { bulletLines } from "../../../lib/text/bullets.js";
import { recordMissionSafe } from "../../../lib/gamification/missions.js";
import { shuffled } from "../../../lib/utils/shuffle.js";

const MIN_LINES = 2;
// Varies how much of the passage gets blanked, from "a couple of sentences"
// (a low fraction, most of the passage stays visible as context) up to
// "most of a paragraph" (a high fraction, only a line or two of context
// remains) -- chosen fresh each round rather than fixed at one difficulty.
const BLANK_FRACTIONS = [0.3, 0.5, 0.85];
const MAX_BLANKS = 6;
const DISTRACTOR_COUNT = 2;

// Every module with usable Teach content, across every unlocked-for-this-user
// subtopic -- mirrors app/api/answer-architect/route.js's eligibleExercises.
async function eligibleTeachModules(userId) {
  const candidateModules = await db
    .select({ id: lessonModules.id, subtopicId: lessonModules.subtopicId, teachContent: lessonModules.teachContent })
    .from(lessonModules)
    .where(isNotNull(lessonModules.teachContent));
  if (!candidateModules.length) return [];

  const subtopicIds = [...new Set(candidateModules.map((m) => m.subtopicId))];
  const subjectBySubtopic = await subjectIdBySubtopicId(subtopicIds);
  const isUnlocked = await unlockedSubjectChecker(userId);

  return candidateModules
    .filter((m) => isUnlocked(subjectBySubtopic[m.subtopicId]))
    .map((m) => ({ id: m.id, lines: bulletLines(m.teachContent || "") }))
    .filter((m) => m.lines.length >= MIN_LINES);
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const pool = await eligibleTeachModules(userId);
    if (pool.length < 1) {
      return NextResponse.json({ error: "Not enough Teach content generated yet to play this — try some regular practice first." }, { status: 404 });
    }

    const passage = pool[Math.floor(Math.random() * pool.length)];
    const totalLines = passage.lines.length;
    const fraction = BLANK_FRACTIONS[Math.floor(Math.random() * BLANK_FRACTIONS.length)];
    const blankCount = Math.min(MAX_BLANKS, Math.max(1, Math.min(totalLines - 1, Math.round(fraction * totalLines))));

    const blankedIndices = shuffled([...Array(totalLines).keys()])
      .slice(0, blankCount)
      .sort((a, b) => a - b);

    let distractorPool = pool.filter((m) => m.id !== passage.id);
    if (!distractorPool.length) distractorPool = pool;
    const distractorModule = distractorPool[Math.floor(Math.random() * distractorPool.length)];
    const distractorIndices = shuffled([...Array(distractorModule.lines.length).keys()]).slice(0, DISTRACTOR_COUNT);

    const correctBank = blankedIndices.map((lineIndex, i) => ({ id: `c${i}`, text: passage.lines[lineIndex] }));
    const distractorBank = distractorIndices.map((lineIndex, i) => ({ id: `d${i}`, text: distractorModule.lines[lineIndex] }));
    const bank = shuffled([...correctBank, ...distractorBank]);

    const passageLines = passage.lines.map((text, i) => {
      const blankIndex = blankedIndices.indexOf(i);
      return blankIndex === -1 ? { blank: false, text } : { blank: true, blankIndex };
    });

    return NextResponse.json({
      passageLines,
      bank: bank.map(({ id, text }) => ({ id, text })),
      answerKeyRef: {
        moduleId: passage.id,
        blankedIndices,
        distractorModuleId: distractorModule.id,
        distractorIndices,
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
    const { answerKeyRef, assignments } = await request.json();
    const { moduleId, blankedIndices, distractorModuleId, distractorIndices } = answerKeyRef || {};
    if (!moduleId || !Array.isArray(blankedIndices) || !distractorModuleId || !Array.isArray(distractorIndices) || !Array.isArray(assignments)) {
      return NextResponse.json({ error: "answerKeyRef and assignments are required" }, { status: 400 });
    }

    const rows = await db.select().from(lessonModules).where(inArray(lessonModules.id, [moduleId, distractorModuleId]));
    const passageModule = rows.find((r) => r.id === moduleId);
    const distractorModule = rows.find((r) => r.id === distractorModuleId);
    if (!passageModule || !distractorModule) return NextResponse.json({ error: "Unknown module in answerKeyRef" }, { status: 404 });

    // Re-derive the same ids GET would have produced -- c0..cN-1 in
    // blankedIndices order, matching the passageLines[i].blankIndex the
    // client used to collect `assignments` in that same order.
    const correctBankIdByBlank = blankedIndices.map((_, i) => `c${i}`);

    let right = 0;
    correctBankIdByBlank.forEach((correctId, i) => {
      if (assignments[i] === correctId) right++;
    });
    const total = correctBankIdByBlank.length;
    const score = total > 0 ? Math.round((right / total) * 100) : 0;

    // A drill, not a graded attempt -- writes nothing to attempts/mastery
    // (same "separate signal" treatment as the other games here), but still
    // counts toward today's "practice" mission like any other practice format.
    const practiceMission = await recordMissionSafe(userId, "practice");

    return NextResponse.json({ score, correctBankIdByBlank, missionRewards: [practiceMission].filter((m) => m?.newlyCompleted).map((m) => m.item) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
