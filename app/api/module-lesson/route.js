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
import { and, eq, asc, sql, inArray } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, sources, lessons, lessonModules, mastery, subjects, pyqs } from "../../../db/schema.js";
import { generateModulePlan, generateModulePlanFromPyqs, generateModuleTeach, generateModulePractice, generateModuleImage } from "../../../lib/ai/generateModules.js";
import { casesSeed } from "../../../db/seed/cases.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../lib/subjects/config.js";
import { sortByTierPriority } from "../../../lib/sources/tiers.js";

const VALID_STAGES = ["teach", "grasp", "remember", "test"];

// A subtopic only goes PYQ-anchored (see selectPyqCandidates below) once it
// has at least this many real PYQs -- with a threshold of 1, a subtopic
// with exactly one real PYQ would get exactly one module for its entire
// Teach->Grasp->Remember->Test cycle, a hard regression from the 2-5 module
// range free decomposition already guarantees. Verified against real seed
// data: this threshold routes 65% of law-optional subtopics through PYQ
// anchoring (2-5 modules each) and leaves the rest (0 or 1 PYQ) on
// unchanged free-decomposition behavior, rather than collapsing 26% of the
// syllabus to single-module subtopics under a naive ">=1" threshold.
const MIN_PYQS_FOR_ANCHORING = 2;
const MAX_MODULES = 5;
const MAX_PYQS_PER_YEAR = 2;

// Picks up to MAX_MODULES real PYQs to anchor modules to, favoring recency
// (what UPSC currently emphasizes) as the relevance signal, capped per year
// so a subtopic with many PYQs concentrated in a couple of recent sittings
// (some gs2 subtopics have 12-24 real PYQs) still gets some spread rather
// than 5 modules from the same one or two exams. Re-sorted by marks
// ascending afterward (a defensible foundational->advanced proxy) so the
// array order handed to the AI -- and therefore each module's orderIndex --
// already reads basics-first, without needing the AI to reorder (which
// would break positional pyqId matching).
function selectPyqCandidates(pyqCandidates) {
  const byYearDesc = [...pyqCandidates].sort((a, b) => b.year - a.year);
  const selected = [];
  const perYearCount = {};
  for (const q of byYearDesc) {
    if (selected.length >= MAX_MODULES) break;
    const count = perYearCount[q.year] || 0;
    if (count >= MAX_PYQS_PER_YEAR) continue;
    selected.push(q);
    perYearCount[q.year] = count + 1;
  }
  return selected.sort((a, b) => a.marks - b.marks);
}

// Enriches plain lesson_modules rows with their anchor PYQ's year/marks (for
// the "Grounded in a real PYQ" UI badge) via one follow-up lookup, rather
// than denormalizing that data onto lesson_modules itself -- matches how
// this codebase handles other FK relationships (e.g. sources.storageUploadId)
// by referencing and re-fetching instead of duplicating.
async function buildModulesSummary(moduleRows) {
  const pyqIds = moduleRows.map((m) => m.pyqId).filter(Boolean);
  const anchorRows = pyqIds.length ? await db.select().from(pyqs).where(inArray(pyqs.id, pyqIds)) : [];
  const anchorById = Object.fromEntries(anchorRows.map((p) => [p.id, p]));
  return moduleRows.map((m) => {
    const anchor = m.pyqId ? anchorById[m.pyqId] : null;
    return {
      id: m.id,
      orderIndex: m.orderIndex,
      title: m.title,
      scopeNote: m.scopeNote,
      pyqId: m.pyqId ?? null,
      pyqYear: anchor?.year ?? null,
      pyqMarks: anchor?.marks ?? null,
    };
  });
}

// Grasp is satisfied the instant the practice phase completes; Remember
// additionally needs the image phase -- same three-phase asymmetry as
// /api/lesson's STAGE_REQUIRES (Grasp doesn't need the diagram, Remember
// does).
const STAGE_REQUIRES = {
  teach: ["teach"],
  grasp: ["teach", "practice"],
  remember: ["teach", "practice", "image"],
};

function nextMissingPhase(row, requiredPhases, stage, force) {
  for (const phase of requiredPhases) {
    if (phase === "teach" && (!row?.generatedAt || (force && stage === "teach"))) return "teach";
    if (phase === "practice" && (!row?.practiceGeneratedAt || (force && stage === "grasp"))) return "practice";
    if (phase === "image" && (!row?.visualImageDataUri || (force && stage === "remember"))) return "image";
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

      const pyqCandidates = selectPyqCandidates(
        await db.select().from(pyqs).where(sql`${subtopicId} = ANY(${pyqs.topics})`)
      );

      let planned;
      if (pyqCandidates.length >= MIN_PYQS_FOR_ANCHORING) {
        planned = await generateModulePlanFromPyqs({ subtopicText: subtopicRow.topicText, pyqCandidates, subjectConfig });
      } else {
        const srcRows = await db.select().from(sources).where(eq(sources.subtopicId, subtopicId));
        const sourceExcerpts = sortByTierPriority(srcRows.filter((s) => s.extractedText))
          .map((s) => s.extractedText)
          .slice(0, 2);
        const caseAnchors = casesSeed
          .filter((c) => c.topics.includes(subtopicId))
          .map((c) => ({ case: c.case, point: c.point }));

        const freeModules = await generateModulePlan({ subtopicText: subtopicRow.topicText, sourceExcerpts, caseAnchors, subjectConfig });
        planned = freeModules.map((m) => ({ ...m, pyqId: null }));
      }

      const inserted = await db
        .insert(lessonModules)
        .values(planned.map((m, i) => ({ subtopicId, orderIndex: i, title: m.title, scopeNote: m.scopeNote, pyqId: m.pyqId })))
        .returning();

      return NextResponse.json({
        subtopicId,
        subtopicText: subtopicRow.topicText,
        subjectDisplayName,
        modules: await buildModulesSummary(inserted),
        ready: false,
        nextPhase: "module-teach",
      });
    }

    if (moduleIndex >= modules.length) {
      return NextResponse.json({
        subtopicId,
        subtopicText: subtopicRow.topicText,
        subjectDisplayName,
        modules: await buildModulesSummary(modules),
        allModulesComplete: true,
      });
    }

    const row = modules[moduleIndex];
    const phase = nextMissingPhase(row, STAGE_REQUIRES[stage] ?? [], stage, force);
    const modulesSummary = await buildModulesSummary(modules);

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

    // Only set for a PYQ-anchored module -- grounds Teach/Practice content
    // in the real question's exact text (see lib/ai/generateModules.js's
    // anti-leak instructions for why Practice's use of this is a hard
    // requirement, not just flavor).
    let pyqQuestionText;
    if (row.pyqId) {
      const anchorRows = await db.select().from(pyqs).where(eq(pyqs.id, row.pyqId));
      pyqQuestionText = anchorRows[0]?.questionText;
    }

    if (phase === "teach") {
      const teach = await generateModuleTeach({
        subtopicText: subtopicRow.topicText,
        moduleTitle: row.title,
        moduleScope: row.scopeNote,
        pyqQuestionText,
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

    if (phase === "practice") {
      const practice = await generateModulePractice({
        subtopicText: subtopicRow.topicText,
        moduleTitle: row.title,
        moduleScope: row.scopeNote,
        teachContent: row.teachContent,
        pyqQuestionText,
        subjectConfig,
      });

      const [saved] = await db
        .update(lessonModules)
        .set({ ...practice, practiceGeneratedAt: new Date() })
        .where(eq(lessonModules.id, row.id))
        .returning();

      // Grasp is fully satisfied here; Remember still needs the image phase,
      // so only Grasp's own request reports ready:true -- a Remember request
      // gets ready:false + nextPhase:"image" and the client's poll loop
      // continues, exactly like /api/lesson's practice-phase branch.
      const ready = stage !== "remember";
      return NextResponse.json({
        subtopicId,
        subtopicText: subtopicRow.topicText,
        subjectDisplayName,
        modules: modulesSummary,
        moduleIndex,
        ...saved,
        ready,
        nextPhase: ready ? null : "image",
      });
    }

    // phase === "image"
    const visualImageDataUri = await generateModuleImage({ moduleTitle: row.title, keyPoints: row.keyPoints });

    const [saved] = await db
      .update(lessonModules)
      .set({ visualImageDataUri })
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
