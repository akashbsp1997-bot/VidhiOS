// app/api/module-lesson/route.js
//
// Module-level counterpart to app/api/lesson/route.js: a subtopic is first
// decomposed into lesson_modules rows (the "plan" phase, an AI call), then
// each module independently runs its own Teach -> Grasp/Remember cycle
// (Test lives in app/api/attempt/route.js's moduleId branch, not here).
// Kept as its own route rather than folded into /api/lesson -- that route's
// nextMissingPhase is already a single-tier state machine (core/practice/
// image for ONE subtopic-wide lesson); cramming a second, outer plan-phase
// tier on top of it would make that function meaningfully harder to audit.
// Same "at most one AI phase per request" discipline as /api/lesson, same
// reason: bundling AI calls into one request was this session's root cause
// of finish_reason:"length"/timeout failures on a free-tier model.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, sources, lessons, lessonModules, mastery, subjects } from "../../../db/schema.js";
import { generateModulePlan, generateModuleTeach, generateModulePractice } from "../../../lib/ai/generateModules.js";
import { casesSeed } from "../../../db/seed/cases.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../lib/subjects/config.js";
import { sortByTierPriority } from "../../../lib/sources/tiers.js";

const VALID_STAGES = ["teach", "grasp", "remember", "test"];

// Grasp and Remember are both satisfied the instant the practice phase
// completes (no separate image phase at module granularity, unlike
// /api/lesson's three-phase STAGE_REQUIRES) -- so this is a 2-phase state
// machine, not 3.
const STAGE_REQUIRES = {
  teach: ["teach"],
  grasp: ["teach", "practice"],
  remember: ["teach", "practice"],
};

function nextMissingPhase(row, requiredPhases, stage, force) {
  for (const phase of requiredPhases) {
    if (phase === "teach" && (!row?.generatedAt || (force && stage === "teach"))) return "teach";
    if (phase === "practice" && (!row?.practiceGeneratedAt || (force && stage === "grasp"))) return "practice";
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subtopicId = searchParams.get("subtopicId");
  const moduleIndex = Number(searchParams.get("moduleIndex") ?? 0);
  const stage = searchParams.get("stage") || "teach";
  const force = searchParams.get("force") === "true";
  // Bypasses the legacy-lessons short-circuit below even when a complete
  // legacy row exists -- the one-click "Upgrade to modules" action in
  // components/LegacyLearnFlow.jsx. Once this runs once, lesson_modules has
  // rows for the subtopic and every future GET takes the normal module path
  // without needing this flag again.
  const upgrade = searchParams.get("upgrade") === "true";
  if (!subtopicId) return NextResponse.json({ error: "subtopicId is required" }, { status: 400 });

  try {
    const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    const subtopicRow = subtopicRows[0];
    if (!subtopicRow) return NextResponse.json({ error: `Unknown subtopic: ${subtopicId}` }, { status: 404 });

    const subjectRows = await db.select().from(subjects).where(eq(subjects.id, subtopicRow.subjectId));
    const subjectDisplayName = subjectRows[0]?.displayName ?? subtopicRow.subjectId;
    const subjectConfig = getSubjectConfig(subtopicRow.subjectId);

    const modules = await db
      .select()
      .from(lessonModules)
      .where(eq(lessonModules.subtopicId, subtopicId))
      .orderBy(asc(lessonModules.orderIndex));

    if (modules.length === 0) {
      if (!upgrade) {
        const legacyRows = await db.select().from(lessons).where(eq(lessons.subtopicId, subtopicId));
        const legacyRow = legacyRows[0];
        if (legacyRow && legacyRow.practiceGeneratedAt) {
          return NextResponse.json({ legacyAvailable: true, ready: false });
        }
      }

      const srcRows = await db.select().from(sources).where(eq(sources.subtopicId, subtopicId));
      const sourceExcerpts = sortByTierPriority(srcRows.filter((s) => s.extractedText))
        .map((s) => s.extractedText)
        .slice(0, 2);
      const caseAnchors = casesSeed
        .filter((c) => c.topics.includes(subtopicId))
        .map((c) => ({ case: c.case, point: c.point }));

      const planned = await generateModulePlan({ subtopicText: subtopicRow.topicText, sourceExcerpts, caseAnchors, subjectConfig });

      const inserted = await db
        .insert(lessonModules)
        .values(planned.map((m, i) => ({ subtopicId, orderIndex: i, title: m.title, scopeNote: m.scopeNote })))
        .returning();

      return NextResponse.json({
        subtopicId,
        subtopicText: subtopicRow.topicText,
        subjectDisplayName,
        modules: inserted.map((m) => ({ id: m.id, orderIndex: m.orderIndex, title: m.title, scopeNote: m.scopeNote })),
        ready: false,
        nextPhase: "module-teach",
      });
    }

    if (moduleIndex >= modules.length) {
      return NextResponse.json({
        subtopicId,
        subtopicText: subtopicRow.topicText,
        subjectDisplayName,
        modules: modules.map((m) => ({ id: m.id, orderIndex: m.orderIndex, title: m.title, scopeNote: m.scopeNote })),
        allModulesComplete: true,
      });
    }

    const row = modules[moduleIndex];
    const phase = nextMissingPhase(row, STAGE_REQUIRES[stage] ?? [], stage, force);
    const modulesSummary = modules.map((m) => ({ id: m.id, orderIndex: m.orderIndex, title: m.title, scopeNote: m.scopeNote }));

    if (phase === null) {
      return NextResponse.json({
        subtopicId,
        subtopicText: subtopicRow.topicText,
        subjectDisplayName,
        modules: modulesSummary,
        moduleIndex,
        ...row,
        ready: true,
        cached: true,
      });
    }

    if (phase === "teach") {
      const teach = await generateModuleTeach({
        subtopicText: subtopicRow.topicText,
        moduleTitle: row.title,
        moduleScope: row.scopeNote,
        subjectConfig,
      });

      const [saved] = await db
        .update(lessonModules)
        .set({ ...teach, generatedAt: new Date() })
        .where(eq(lessonModules.id, row.id))
        .returning();

      return NextResponse.json({
        subtopicId,
        subtopicText: subtopicRow.topicText,
        subjectDisplayName,
        modules: modulesSummary,
        moduleIndex,
        ...saved,
        ready: false,
        nextPhase: "practice",
      });
    }

    // phase === "practice"
    const practice = await generateModulePractice({
      subtopicText: subtopicRow.topicText,
      moduleTitle: row.title,
      moduleScope: row.scopeNote,
      teachContent: row.teachContent,
      subjectConfig,
    });

    const [saved] = await db
      .update(lessonModules)
      .set({ ...practice, practiceGeneratedAt: new Date() })
      .where(eq(lessonModules.id, row.id))
      .returning();

    return NextResponse.json({
      subtopicId,
      subtopicText: subtopicRow.topicText,
      subjectDisplayName,
      modules: modulesSummary,
      moduleIndex,
      ...saved,
      ready: true,
      nextPhase: null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Mirrors /api/lesson's POST exactly (mastery.stage bookkeeping), extended
// with currentModuleIndex so re-entering a subtopic resumes on the right
// module.
export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { subtopicId, moduleIndex, stage } = await request.json();
    if (!subtopicId || typeof moduleIndex !== "number" || !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: "subtopicId, a numeric moduleIndex, and a valid stage are required" }, { status: 400 });
    }

    const existingRows = await db
      .select()
      .from(mastery)
      .where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
    if (existingRows[0]) {
      await db
        .update(mastery)
        .set({ stage, currentModuleIndex: moduleIndex })
        .where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
    } else {
      await db.insert(mastery).values({ userId, subtopicId, stage, currentModuleIndex: moduleIndex });
    }

    return NextResponse.json({ subtopicId, moduleIndex, stage });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
