// lib/adaptive/lockState.js
//
// The single shared "is this subtopic locked for this user" helper --
// every route that needs to enforce (not just display) the subtopic-chain
// gate calls this instead of recomputing paper order itself, so the
// dashboard's displayed order and server-side enforcement can never drift
// apart. DB-touching (unlike lib/adaptive/unlocks.js, which stays pure).

import { eq, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { subtopics, mastery, sources, pyqs } from "../../db/schema.js";
import { computeDifficultyScore, orderSubtopicsWithinPaper, computeSubtopicLocks } from "./unlocks.js";

/**
 * Loads every subtopic in (subjectId, paper), computes the same
 * basics-to-advanced order the dashboard shows, and returns
 * Map<subtopicId, lockInfo> for this user. lockInfo: { locked,
 * requiredSubtopicId, requiredSubtopicText, requiredMasteryPct,
 * currentMasteryPct, difficultyScore }.
 */
export async function loadPaperLockMap(userId, subjectId, paper) {
  const paperSubtopics = await db
    .select()
    .from(subtopics)
    .where(eq(subtopics.subjectId, subjectId));
  const inPaper = paperSubtopics.filter((s) => s.paper === paper);
  if (!inPaper.length) return new Map();

  const ids = inPaper.map((s) => s.id);
  const sourceRows = await db.select().from(sources).where(inArray(sources.subtopicId, ids));
  const pyqRows = await db.select().from(pyqs);
  const masteryRows = await db.select().from(mastery).where(eq(mastery.userId, userId));
  const masteryBySubtopic = Object.fromEntries(masteryRows.map((m) => [m.subtopicId, m]));

  const sourceTierBySubtopic = {};
  for (const row of sourceRows) {
    const bucket = (sourceTierBySubtopic[row.subtopicId] ??= { ncert: 0, total: 0 });
    bucket.total += 1;
    if (row.sourceTier === "ncert") bucket.ncert += 1;
  }

  const pyqMarksBySubtopic = {};
  for (const q of pyqRows) {
    for (const t of q.topics) {
      if (ids.includes(t)) (pyqMarksBySubtopic[t] ??= []).push(q.marks);
    }
  }

  const withScore = inPaper.map((s) => ({
    id: s.id,
    topicText: s.topicText,
    pyqFrequency: s.pyqFrequency,
    difficultyScore: computeDifficultyScore(sourceTierBySubtopic[s.id], pyqMarksBySubtopic[s.id]),
  }));
  const ordered = orderSubtopicsWithinPaper(withScore);

  const masteryScoreById = Object.fromEntries(ordered.map((s) => [s.id, masteryBySubtopic[s.id]?.masteryScore ?? 0]));
  const locks = computeSubtopicLocks(ordered, masteryScoreById);

  const result = new Map();
  for (const s of ordered) {
    result.set(s.id, { ...locks.get(s.id), difficultyScore: s.difficultyScore });
  }
  return result;
}
