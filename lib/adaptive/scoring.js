// lib/adaptive/scoring.js
//
// Display-only "Pass/Fail" framing for a graded attempt's 0-100 score --
// deliberately NOT a gate. Real UPSC exams commonly use 33% as the
// qualifying/pass convention, so that's the number shown to the student as
// "you'd have passed this" -- it never blocks progression, feeds mastery
// differently, or interacts with lib/adaptive/unlocks.js's
// MASTERY_UNLOCK_THRESHOLD (a separate, much lower number by design -- see
// that file's header for why the two are intentionally decoupled).
export const PASSING_SCORE_PCT = 33;

export function isPassingScore(score0to100) {
  return typeof score0to100 === "number" && score0to100 >= PASSING_SCORE_PCT;
}
