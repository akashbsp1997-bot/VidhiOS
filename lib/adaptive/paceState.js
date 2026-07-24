// lib/adaptive/paceState.js
//
// DB-touching wrapper around the pure logic in lib/adaptive/pacing.js --
// same split as lib/adaptive/unlocks.js (pure) / lib/adaptive/lockState.js
// (DB). Owns the actual reads/writes against db/schema.js's
// pace_checkpoints table.

import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { paceCheckpoints, subtopics, mastery } from "../../db/schema.js";
import { loadUnlockedSubjectIds, planStartDate } from "./subjectUnlockState.js";
import { windowIndexForDay, windowStartDay, computePaceStatus, PACE_START_MASTERY } from "./pacing.js";
import { dayNumberForDate } from "./planEngine.js";

/**
 * Average mastery across every subtopic in every subject this user has
 * unlocked (GS + their one optional, mirroring app/api/readiness's own
 * unlockedSubjectIds -- broader than subjectUnlockState's GS-only
 * loadProgressSignals, which exists for the separate GS-subject-unlock
 * lockdown feature, not this). An unattempted subtopic contributes 0, same
 * convention as every other avg-mastery computation in this app -- this is
 * "how much of your full unlocked syllabus do you actually have," not
 * "your average score on things you've tried."
 */
async function currentAvgMasteryPct(userId) {
  const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
  const unlockedSubjectIds = optionalSubjectId ? [...unlockedGsIds, optionalSubjectId] : unlockedGsIds;
  if (!unlockedSubjectIds.length) return 0;

  const subtopicRows = await db.select({ id: subtopics.id }).from(subtopics).where(inArray(subtopics.subjectId, unlockedSubjectIds));
  const ids = subtopicRows.map((s) => s.id);
  if (!ids.length) return 0;

  const masteryRows = await db
    .select({ subtopicId: mastery.subtopicId, masteryScore: mastery.masteryScore })
    .from(mastery)
    .where(and(eq(mastery.userId, userId), inArray(mastery.subtopicId, ids)));
  const masteryBySubtopic = Object.fromEntries(masteryRows.map((m) => [m.subtopicId, m.masteryScore]));
  const sum = ids.reduce((acc, id) => acc + (masteryBySubtopic[id] ?? 0), 0);
  return (sum / ids.length) * 100;
}

/**
 * The current pace status, creating this window's checkpoint row on first
 * access if it doesn't exist yet (lazy, same pattern as
 * subjectUnlockState.js's maybeUnlockNextGsSubject -- no cron needed).
 * Window 0's anchor is always the fixed PACE_START_MASTERY floor (5%), not
 * measured -- there's no "prior window" to have observed usage in yet.
 * Every later window anchors to whatever mastery was ACTUALLY measured the
 * first time that window was reached, which is the "adjusting every 30
 * days based on user usage" behavior: a window's target is fixed once set,
 * even if this function is called many times within the same window.
 * Returns null before onboarding has run.
 */
export async function getPaceStatus(userId) {
  const start = await planStartDate(userId);
  if (!start) return null;

  const dayNumber = dayNumberForDate(start, new Date());
  const currentWindowIndex = windowIndexForDay(dayNumber);
  const currentMasteryPct = await currentAvgMasteryPct(userId);

  const [existing] = await db
    .select()
    .from(paceCheckpoints)
    .where(and(eq(paceCheckpoints.userId, userId), eq(paceCheckpoints.windowIndex, currentWindowIndex)));

  let anchorMasteryPct;
  if (existing) {
    anchorMasteryPct = existing.anchorMasteryPct;
  } else {
    anchorMasteryPct = currentWindowIndex === 0 ? PACE_START_MASTERY * 100 : currentMasteryPct;
    await db
      .insert(paceCheckpoints)
      .values({ userId, windowIndex: currentWindowIndex, windowStartDay: windowStartDay(currentWindowIndex), anchorMasteryPct })
      .onConflictDoNothing({ target: [paceCheckpoints.userId, paceCheckpoints.windowIndex] });
  }

  const anchorDay = windowStartDay(currentWindowIndex);
  const paceStatus = computePaceStatus({ dayNumber, anchorDay, anchorMasteryPct, currentMasteryPct });
  return { dayNumber, windowIndex: currentWindowIndex, anchorDay, anchorMasteryPct, ...paceStatus };
}
