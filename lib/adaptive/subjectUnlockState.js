// lib/adaptive/subjectUnlockState.js
//
// DB-touching wrapper around the pure logic in lib/adaptive/subjectUnlocks.js
// -- same split as lib/adaptive/unlocks.js (pure) / lib/adaptive/lockState.js
// (DB), for the same reason: routes/tests can exercise the unlock rules
// without a database, while this file owns the actual reads/writes against
// db/schema.js's subjectUnlocks table.

import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { subjectUnlocks, subjects, subtopics, mastery } from "../../db/schema.js";
import { GS_UNLOCK_ORDER, nextGsUnlock, isGatedCategory } from "./subjectUnlocks.js";

/**
 * All of this user's unlocked-subject rows, split into the GS ids (ordered
 * per GS_UNLOCK_ORDER, not insertion order) and the single optional id (or
 * null if onboarding hasn't run yet).
 */
export async function loadUnlockedSubjectIds(userId) {
  const rows = await db.select().from(subjectUnlocks).where(eq(subjectUnlocks.userId, userId));
  const rowIds = rows.map((r) => r.subjectId);
  const unlockedGsIds = GS_UNLOCK_ORDER.filter((id) => rowIds.includes(id));
  const optionalSubjectId = rowIds.find((id) => !GS_UNLOCK_ORDER.includes(id)) ?? null;
  return { unlockedGsIds, optionalSubjectId, all: rowIds };
}

/**
 * The single choke point every content route (subtopics/lesson/module-lesson/
 * attempt) calls before serving a subject's content. Ungated subjects
 * (prelims, essay, qualifying-language) are always unlocked -- this only
 * ever restricts 'gs'/'optional' subjects. Looks the subject's category up
 * from the DB rather than trusting the caller, so a route can't accidentally
 * skip gating by mislabeling a subjectId.
 */
export async function isSubjectUnlocked(userId, subjectId) {
  const [subject] = await db.select({ category: subjects.category }).from(subjects).where(eq(subjects.id, subjectId));
  if (!subject || !isGatedCategory(subject.category)) return true;
  const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
  return unlockedGsIds.includes(subjectId) || optionalSubjectId === subjectId;
}

export async function hasStartedOnboarding(userId) {
  const rows = await db.select({ subjectId: subjectUnlocks.subjectId }).from(subjectUnlocks).where(eq(subjectUnlocks.userId, userId)).limit(1);
  return rows.length > 0;
}

/**
 * One-time onboarding write: 2 GS subjects + 1 optional subject, all
 * unlocked together. Throws (route turns this into a 4xx) rather than
 * silently no-op-ing on bad input or a repeat call -- both are caller bugs,
 * not states this layer should paper over.
 */
export async function initializeSubjectUnlocks(userId, { gsSubjectIds, optionalSubjectId }) {
  if (!Array.isArray(gsSubjectIds) || gsSubjectIds.length !== 2 || new Set(gsSubjectIds).size !== 2 || !gsSubjectIds.every((id) => GS_UNLOCK_ORDER.includes(id))) {
    throw new Error("gsSubjectIds must be exactly 2 distinct GS subject ids.");
  }
  if (typeof optionalSubjectId !== "string" || !optionalSubjectId) {
    throw new Error("optionalSubjectId is required.");
  }
  if (await hasStartedOnboarding(userId)) {
    throw new Error("Subject unlocks already initialized for this user.");
  }

  const [optionalSubject] = await db.select().from(subjects).where(eq(subjects.id, optionalSubjectId));
  if (!optionalSubject || optionalSubject.category !== "optional") {
    throw new Error(`"${optionalSubjectId}" is not a valid optional subject.`);
  }

  const now = new Date();
  await db
    .insert(subjectUnlocks)
    .values([...gsSubjectIds, optionalSubjectId].map((subjectId) => ({ userId, subjectId, unlockedAt: now })))
    .onConflictDoNothing({ target: [subjectUnlocks.userId, subjectUnlocks.subjectId] });
}

/** Earliest unlockedAt across this user's rows -- "day 1" of their plan. Null if onboarding hasn't run. */
export async function planStartDate(userId) {
  const rows = await db.select({ unlockedAt: subjectUnlocks.unlockedAt }).from(subjectUnlocks).where(eq(subjectUnlocks.userId, userId));
  if (!rows.length) return null;
  return rows.reduce((min, r) => (r.unlockedAt < min ? r.unlockedAt : min), rows[0].unlockedAt);
}

/**
 * Opportunistic check-and-unlock, meant to be called on dashboard load (not
 * on a timer): if the next GS subject is due (mastery or calendar, see
 * nextGsUnlock), writes its unlock row and returns its id; otherwise
 * returns null. No-ops (returns null) before onboarding has run.
 */
export async function maybeUnlockNextGsSubject(userId) {
  const { unlockedGsIds } = await loadUnlockedSubjectIds(userId);
  if (!unlockedGsIds.length) return null; // onboarding hasn't run

  const start = await planStartDate(userId);
  const daysElapsed = start ? Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000)) : 0;

  const unlockedSubtopics = await db.select({ id: subtopics.id }).from(subtopics).where(inArray(subtopics.subjectId, unlockedGsIds));
  const ids = unlockedSubtopics.map((s) => s.id);
  const masteryRows = ids.length ? await db.select({ subtopicId: mastery.subtopicId, masteryScore: mastery.masteryScore }).from(mastery).where(and(eq(mastery.userId, userId), inArray(mastery.subtopicId, ids))) : [];
  const masteryBySubtopic = Object.fromEntries(masteryRows.map((m) => [m.subtopicId, m.masteryScore]));
  const avgMasteryOfUnlocked = ids.length ? ids.reduce((sum, id) => sum + (masteryBySubtopic[id] ?? 0), 0) / ids.length : 0;

  const nextId = nextGsUnlock({ unlockedGsIds, avgMasteryOfUnlocked, daysElapsed });
  if (!nextId) return null;

  await db.insert(subjectUnlocks).values({ userId, subjectId: nextId }).onConflictDoNothing({ target: [subjectUnlocks.userId, subjectUnlocks.subjectId] });
  return nextId;
}
