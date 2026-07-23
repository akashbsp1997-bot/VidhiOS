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
// Calendar fallback, keyed by "which Nth GS subject is this" -- the 3rd GS
// subject unlocks by day 90 (~3 months) regardless of mastery, the 4th by
// day 180 (~6 months), leaving the back half of a 1-year plan for
// consolidation, testing, and revision even for a student who never hits
// the mastery threshold early.
export const GS_TIME_CHECKPOINT_DAYS = { 3: 90, 4: 180 };

/**
 * Given the GS subjects already unlocked (in GS_UNLOCK_ORDER, e.g.
 * ["gs1","gs2"]), their average mastery, and days elapsed since the plan
 * started, returns the next GS subjectId to unlock, or null if none is due
 * yet (or all four are already unlocked).
 */
export function nextGsUnlock({ unlockedGsIds, avgMasteryOfUnlocked, daysElapsed }) {
  const nextPosition = unlockedGsIds.length; // 0-based index into GS_UNLOCK_ORDER
  if (nextPosition >= GS_UNLOCK_ORDER.length) return null;

  const nth = nextPosition + 1; // "this would be the Nth GS subject unlocked"
  const checkpointDay = GS_TIME_CHECKPOINT_DAYS[nth];
  const masteryReady = avgMasteryOfUnlocked >= SUBJECT_UNLOCK_MASTERY_THRESHOLD;
  const timeReady = checkpointDay != null && daysElapsed >= checkpointDay;

  return masteryReady || timeReady ? GS_UNLOCK_ORDER[nextPosition] : null;
}
