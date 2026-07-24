// lib/adaptive/pacing.js
//
// A trajectory tracker, not another blended score: lib/adaptive/readiness.js
// deliberately refuses to blend mastery/MCQ/mock-test performance into one
// number, and this doesn't either -- it's a fourth, independent lens
// ("are we on schedule for the 1-year goal"), never mixed into mastery
// itself or into any unlock/gating decision. Pure, DB-free, same discipline
// as the rest of lib/adaptive/*; lib/adaptive/paceState.js wraps this with
// the actual DB reads/writes against the pace_checkpoints table.
//
// The model, in one paragraph: average mastery across a student's currently
// unlocked syllabus should climb from a 5% starting floor (matching
// lib/adaptive/unlocks.js's MASTERY_UNLOCK_THRESHOLD) to a 70% one-year
// goal -- deliberately above typical topper-level performance (real UPSC
// toppers often clear well under 60% of total marks; this app's target is
// "meaningfully stronger than that," not "just pass"). Rather than a single
// fixed year-long ramp, the target re-anchors every 30 days to the
// student's OWN actual mastery at the start of that window -- a fallen-
// behind window steepens the remaining slope, a strong window relaxes it --
// same idea as a GPS recalculating ETA from your real position, not
// silently drifting off a stale original plan.

export const PACE_START_MASTERY = 0.05; // day-0 floor, matches MASTERY_UNLOCK_THRESHOLD
export const PACE_TARGET_MASTERY = 0.70; // day-365 goal, deliberately above typical topper-level scoring
export const PACE_HORIZON_DAYS = 365;
export const PACE_WINDOW_DAYS = 30;

export function windowIndexForDay(dayNumber) {
  return Math.max(0, Math.floor(dayNumber / PACE_WINDOW_DAYS));
}

export function windowStartDay(windowIndex) {
  return windowIndex * PACE_WINDOW_DAYS;
}

/**
 * The straight-line target for the CURRENT window, anchored at
 * (anchorDay, anchorMasteryPct) and aimed at (PACE_HORIZON_DAYS,
 * PACE_TARGET_MASTERY*100) -- recomputed fresh every window from wherever
 * the student actually is, not from the original day-0 plan. Once
 * anchorDay is at or past the horizon, there's no more runway left to
 * re-slope -- target holds flat at PACE_TARGET_MASTERY.
 */
export function computeWindowTarget({ anchorDay, anchorMasteryPct }) {
  const remainingDays = PACE_HORIZON_DAYS - anchorDay;
  if (remainingDays <= 0) {
    return { dailyGainPct: 0, targetAtWindowEndPct: PACE_TARGET_MASTERY * 100 };
  }
  const targetPct = PACE_TARGET_MASTERY * 100;
  const dailyGainPct = (targetPct - anchorMasteryPct) / remainingDays;
  const windowEndDay = Math.min(anchorDay + PACE_WINDOW_DAYS, PACE_HORIZON_DAYS);
  const targetAtWindowEndPct = Math.min(targetPct, anchorMasteryPct + dailyGainPct * (windowEndDay - anchorDay));
  return { dailyGainPct, targetAtWindowEndPct };
}

/**
 * Where the student SHOULD be today (linear interpolation within the
 * current window) vs where they actually are. `status` uses a 3-point-of-
 * mastery band as "on pace" -- small day-to-day noise in a single AI-graded
 * score shouldn't flip the label back and forth; see engine.js's own
 * K-floor/tier-hold comments for the same "don't overreact to one data
 * point" reasoning applied elsewhere in this codebase.
 */
export function computePaceStatus({ dayNumber, anchorDay, anchorMasteryPct, currentMasteryPct }) {
  const { dailyGainPct, targetAtWindowEndPct } = computeWindowTarget({ anchorDay, anchorMasteryPct });
  const daysIntoWindow = Math.max(0, dayNumber - anchorDay);
  const expectedMasteryPct = Math.min(targetAtWindowEndPct, anchorMasteryPct + dailyGainPct * daysIntoWindow);
  const deltaPct = currentMasteryPct - expectedMasteryPct;

  let status = "on_pace";
  if (deltaPct > 3) status = "ahead";
  else if (deltaPct < -3) status = "behind";

  // If the CURRENT actual rate (since this window's anchor) held for the
  // rest of the year, where would the student end up -- a second, more
  // forward-looking number alongside "on pace right now."
  const observedDailyRate = daysIntoWindow > 0 ? (currentMasteryPct - anchorMasteryPct) / daysIntoWindow : dailyGainPct;
  const daysRemaining = Math.max(0, PACE_HORIZON_DAYS - dayNumber);
  const projectedFinalMasteryPct = Math.max(0, Math.min(100, currentMasteryPct + observedDailyRate * daysRemaining));

  return { expectedMasteryPct, currentMasteryPct, deltaPct, status, projectedFinalMasteryPct, dailyGainNeededPct: dailyGainPct };
}
