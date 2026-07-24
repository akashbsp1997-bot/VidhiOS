// lib/adaptive/scoring.js
//
// Real UPSC exams commonly use 33% as the qualifying/pass convention, so
// that's the number shown to the student as "you'd have passed this" on a
// graded score. Two legitimate but distinct uses:
//   - Against the REAL syllabus content (subtopic/module mastery-gating,
//     lib/adaptive/unlocks.js's MASTERY_UNLOCK_THRESHOLD): display-only,
//     NEVER a gate -- a much lower, separate number decides actual
//     progression there by design (see that file's header for why).
//   - Inside a self-contained GAME layered on top (e.g.
//     components/EssayTournament.jsx's round-clear bar): fair game to use
//     as a real advance/eliminate threshold -- a game round ending because
//     you didn't clear 33% is a game rule, not a barrier to the real
//     content underneath, which stays exactly as reachable either way.
export const PASSING_SCORE_PCT = 33;

export function isPassingScore(score0to100) {
  return typeof score0to100 === "number" && score0to100 >= PASSING_SCORE_PCT;
}
