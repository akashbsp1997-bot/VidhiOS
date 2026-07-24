// lib/ai/contentGrounding.js
//
// Shared grounding inputs for content-first question generation (see the
// 2026-07-24 "content-first" change) -- factored out once instead of being
// re-fetched separately in app/api/attempt/route.js, app/api/mcq/route.js,
// and the module-Test generation path, since all three now need the same two
// things: a subtopic's recent tagged current-affairs items, and a small
// sample of real PYQs to use as a style/difficulty REFERENCE (never served
// as the question itself -- see lib/ai/generateQuestion.js's anti-leak
// wording for how that reference is used in the actual prompt).

import { and, gte, sql, desc } from "drizzle-orm";
import { db } from "../db.js";
import { currentAffairsItems } from "../../db/schema.js";
import { shuffled } from "../utils/shuffle.js";

/**
 * Recent current-affairs items tagged to this subtopic
 * (currentAffairsItems.relatedSubtopicIds, an existing structured array
 * column populated by app/api/cron/fetch-current-affairs/route.js but never
 * queried by anything else until now). Best-effort: most subtopics won't
 * have any, especially doctrinal/legal ones with little current-affairs
 * angle -- callers must handle an empty array gracefully, same as they
 * already do for sparse `sources.extractedText`.
 */
export async function recentCurrentAffairsExcerpts(subtopicId, { days = 60, limit = 5 } = {}) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db
    .select({ title: currentAffairsItems.title, summary: currentAffairsItems.summary, publishedDate: currentAffairsItems.publishedDate })
    .from(currentAffairsItems)
    .where(and(sql`${subtopicId} = ANY(${currentAffairsItems.relatedSubtopicIds})`, gte(currentAffairsItems.publishedDate, cutoff)))
    .orderBy(desc(currentAffairsItems.publishedDate))
    .limit(limit);
  return rows;
}

/**
 * Up to `count` real PYQs from an already-fetched pool, to feed into a
 * generation prompt as a reference (pure, no DB -- caller already has
 * pyqPool from its own subtopic-scoped query). Prefers ones this user
 * hasn't already seen served as a reference before, same "prefer unseen"
 * bias chooseQuestionPlan used when PYQs were still directly served.
 * Returns [] when the pool is empty (a subtopic with zero real PYQs, e.g.
 * CSAT quant, degrades gracefully -- generation just runs ungrounded by any
 * PYQ, same as it already does when sourceExcerpts is empty).
 */
export function pickReferencePyqs(pyqPool, seenQuestionRefIds, { count = 2 } = {}) {
  if (!pyqPool || !pyqPool.length) return [];
  const seen = new Set((seenQuestionRefIds || []).map(String));
  const unseen = pyqPool.filter((q) => !seen.has(String(q.id)));
  const pool = unseen.length ? unseen : pyqPool;
  return shuffled(pool)
    .slice(0, count)
    .map((q) => ({ id: q.id, questionText: q.questionText, marks: q.marks, year: q.year }));
}
