// lib/adaptive/subjectUnlocks.js
//
// A THIRD, higher-level gate above subtopic/module gating (lib/adaptive/
// unlocks.js): which whole GS papers and which single optional subject a
// student can see subtopics for at all. Pure, DB-free -- same house
// discipline as unlocks.js/engine.js, independently testable with plain
// `node`. lib/adaptive/subjectUnlockState.js wraps this with the actual DB
// reads/writes.
//
// Real UPSC candidates only ever sit ONE optional paper -- so unlike GS
// papers (which everyone eventually studies all four of), the optional
// choice is made ONCE at onboarding and never grows automatically; only the
// GS unlock COUNT progresses (2 -> 3 -> 4) as the student advances. "Both
// combined" per explicit request: whichever of (mastery threshold, time
// checkpoint) comes first unlocks the next GS subject, so steady progress
// is never blocked by a slow calendar and a slow learner is never
// permanently stuck waiting on mastery alone.

// Only these two subjects.category values are gated at all -- prelims,
// essay, and the qualifying language papers stay accessible exactly as
// before (subtopic-level gating only), since the user's request was
// specifically about GS and optional subjects.
export const GATED_CATEGORIES = ["gs", "optional"];

export function isGatedCategory(category) {
  return GATED_CATEGORIES.includes(category);
}

// GS1+GS2 recommended as the starting pair -- GS2 already has real content
// in this app, and GS1/GS2 are the natural reading order. Swappable by the
// student at onboarding (see components/OnboardingSetup.jsx), not forced.
export const RECOMMENDED_INITIAL_GS_SUBJECT_IDS = ["gs1", "gs2"];
export const GS_UNLOCK_ORDER = ["gs1", "gs2", "gs3", "gs4"];

export const SUBJECT_UNLOCK_MASTERY_THRESHOLD = 0.6; // same convention as lib/adaptive/unlocks.js's MASTERY_UNLOCK_THRESHOLD
// Calendar checkpoints, keyed by "which Nth GS subject is this" -- the 3rd GS
// subject's checkpoint is day 90 (~3 months), the 4th's is day 180 (~6
// months). Per explicit request these no longer force-unlock the next
// subject on their own (see the removed "timeReady" free-unlock below,
// folded into computeLockdownState instead) -- they're now the trigger for
// lockdown, not a bypass around the mastery bar.
export const GS_TIME_CHECKPOINT_DAYS = { 3: 90, 4: 180 };

// Recovery floor for lockdown (see computeLockdownState) -- deliberately
// lower than SUBJECT_UNLOCK_MASTERY_THRESHOLD (0.6). A missed checkpoint no
// longer force-unlocks the next subject; instead it narrows the whole app
// down to just the adaptive-practice engine (lib/adaptive/engine.js) until
// mastery climbs back to this floor. Recovering here lifts the lockdown and
// restores normal access, but doesn't by itself unlock the next subject --
// that still only happens once mastery actually clears the full 0.6 bar.
export const LOCKDOWN_RECOVERY_MASTERY_THRESHOLD = 0.3;

function nextCheckpoint(unlockedGsIds) {
  const nextPosition = unlockedGsIds.length; // 0-based index into GS_UNLOCK_ORDER
  if (nextPosition >= GS_UNLOCK_ORDER.length) return null;
  const nth = nextPosition + 1; // "this would be the Nth GS subject unlocked"
  return { nextPosition, checkpointDay: GS_TIME_CHECKPOINT_DAYS[nth] ?? null };
}

/**
 * Given the GS subjects already unlocked (in GS_UNLOCK_ORDER, e.g.
 * ["gs1","gs2"]) and their average mastery, returns the next GS subjectId to
 * unlock, or null if not ready yet (or all four are already unlocked).
 * Mastery-only -- see GS_TIME_CHECKPOINT_DAYS's comment for why the old
 * calendar-fallback free-unlock was removed.
 */
export function nextGsUnlock({ unlockedGsIds, avgMasteryOfUnlocked }) {
  const next = nextCheckpoint(unlockedGsIds);
  if (!next) return null;
  return avgMasteryOfUnlocked >= SUBJECT_UNLOCK_MASTERY_THRESHOLD ? GS_UNLOCK_ORDER[next.nextPosition] : null;
}

/**
 * Whether the student is currently locked down: the next GS subject's day
 * checkpoint has passed, but mastery never reached SUBJECT_UNLOCK_MASTERY_THRESHOLD
 * -- a missed checkpoint. Lockdown lasts until avgMasteryOfUnlocked climbs
 * back to LOCKDOWN_RECOVERY_MASTERY_THRESHOLD (30%), not all the way to the
 * real 60% unlock bar. Returns { lockedDown: false } once all four GS
 * subjects are unlocked (no more checkpoints left to miss).
 */
export function computeLockdownState({ unlockedGsIds, avgMasteryOfUnlocked, daysElapsed }) {
  const next = nextCheckpoint(unlockedGsIds);
  if (!next || next.checkpointDay == null || daysElapsed < next.checkpointDay) {
    return { lockedDown: false };
  }
  if (avgMasteryOfUnlocked >= SUBJECT_UNLOCK_MASTERY_THRESHOLD) {
    return { lockedDown: false };
  }
  return {
    lockedDown: avgMasteryOfUnlocked < LOCKDOWN_RECOVERY_MASTERY_THRESHOLD,
    requiredMasteryPct: Math.round(LOCKDOWN_RECOVERY_MASTERY_THRESHOLD * 100),
    currentMasteryPct: Math.round(avgMasteryOfUnlocked * 100),
    checkpointDay: next.checkpointDay,
  };
}
