// lib/adaptive/moduleContentReady.js
//
// The actual "generate this module's next missing phase and save it" step,
// extracted out of app/api/module-lesson/route.js's GET handler so it can be
// called from two places: that route (live, one phase per request, same
// discipline as always -- avoids finish_reason:"length"/timeout on the free
// tier) and app/api/cron/prepare-next-day/route.js (the new overnight
// pre-generation job, which loops phase-by-phase the same way but for
// tomorrow's plan topics instead of in response to a student's click).
//
// Deliberately narrow: this only knows how to generate ONE named phase for
// ONE module and persist it. Working out WHICH phase is next, and whether a
// student is even allowed to see it yet (stage/module locks), stays in each
// caller -- the live route's stage/force-aware nextMissingPhase() is a
// different question from the cron's "just fill in whatever teach/practice/
// image is still missing" loop (see nextMissingModulePhase below), so they're
// kept as two separate, purpose-fit functions rather than one over-general one.

import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { lessonModules, pyqs } from "../../db/schema.js";
import { generateModuleTeach, generateModulePractice, generateModuleImage } from "../ai/generateModules.js";

/** teach -> practice -> image -> null, ignoring the requesting stage entirely -- what the overnight pre-gen loop (A5) needs, unlike the live route's per-requested-stage nextMissingPhase. */
export function nextMissingModulePhase(row) {
  if (!row?.generatedAt) return "teach";
  if (!row?.practiceGeneratedAt) return "practice";
  if (!row?.visualImageDataUri) return "image";
  return null;
}

/**
 * Generates exactly the named phase ("teach" | "practice" | "image") for one
 * module and writes it back. Caller is responsible for having already
 * decided this phase is actually missing -- this does not check.
 */
export async function ensureModuleStagePhase(moduleRow, subtopicRow, subjectConfig, phase) {
  let pyqQuestionText;
  if (moduleRow.pyqId) {
    const anchorRows = await db.select().from(pyqs).where(eq(pyqs.id, moduleRow.pyqId));
    pyqQuestionText = anchorRows[0]?.questionText;
  }

  if (phase === "teach") {
    const teach = await generateModuleTeach({
      subtopicText: subtopicRow.topicText,
      moduleTitle: moduleRow.title,
      moduleScope: moduleRow.scopeNote,
      pyqQuestionText,
      subjectConfig,
    });
    const [saved] = await db
      .update(lessonModules)
      .set({ ...teach, generatedAt: new Date() })
      .where(eq(lessonModules.id, moduleRow.id))
      .returning();
    return saved;
  }

  if (phase === "practice") {
    const practice = await generateModulePractice({
      subtopicText: subtopicRow.topicText,
      moduleTitle: moduleRow.title,
      moduleScope: moduleRow.scopeNote,
      teachContent: moduleRow.teachContent,
      pyqQuestionText,
      subjectConfig,
    });
    const [saved] = await db
      .update(lessonModules)
      .set({ ...practice, practiceGeneratedAt: new Date() })
      .where(eq(lessonModules.id, moduleRow.id))
      .returning();
    return saved;
  }

  // phase === "image"
  const visualImageDataUri = await generateModuleImage({ moduleTitle: moduleRow.title, keyPoints: moduleRow.keyPoints });
  const [saved] = await db
    .update(lessonModules)
    .set({ visualImageDataUri })
    .where(eq(lessonModules.id, moduleRow.id))
    .returning();
  return saved;
}
