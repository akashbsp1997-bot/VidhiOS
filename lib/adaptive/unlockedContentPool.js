// lib/adaptive/unlockedContentPool.js
//
// Shared "is this subtopic's subject unlocked for this user" filtering,
// factored out of app/api/answer-architect/route.js so
// app/api/fill-blanks/route.js doesn't reimplement the same check -- both
// scan across EVERY subtopic's cached module content (not one subtopic at a
// time, unlike most routes), so both need the same subject-unlock pass over
// the whole catalog rather than a single per-subtopic lookup.

import { inArray } from "drizzle-orm";
import { db } from "../db.js";
import { subjects, subtopics } from "../../db/schema.js";
import { loadUnlockedSubjectIds } from "./subjectUnlockState.js";
import { isGatedCategory } from "./subjectUnlocks.js";

/** Returns a (subjectId) => boolean predicate for this user, computed once. */
export async function unlockedSubjectChecker(userId) {
  const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
  const allSubjectRows = await db.select({ id: subjects.id, category: subjects.category }).from(subjects);
  const categoryBySubject = Object.fromEntries(allSubjectRows.map((s) => [s.id, s.category]));
  return function isUnlocked(subjectId) {
    const category = categoryBySubject[subjectId];
    if (!isGatedCategory(category)) return true;
    return unlockedGsIds.includes(subjectId) || optionalSubjectId === subjectId;
  };
}

/** Map<subtopicId, subjectId> for a given set of subtopic ids. */
export async function subjectIdBySubtopicId(subtopicIds) {
  if (!subtopicIds.length) return {};
  const rows = await db.select({ id: subtopics.id, subjectId: subtopics.subjectId }).from(subtopics).where(inArray(subtopics.id, subtopicIds));
  return Object.fromEntries(rows.map((s) => [s.id, s.subjectId]));
}
