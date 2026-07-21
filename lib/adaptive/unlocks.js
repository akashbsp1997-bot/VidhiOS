// lib/adaptive/unlocks.js
//
// Pure, dependency-free mastery-gating logic -- same DB-free discipline as
// engine.js, so it stays independently testable with plain `node` and the
// DB-touching layer (lib/adaptive/lockState.js) that wraps it stays thin.
//
// Three separate gates live here, one per layer of the app's hierarchy:
//   - subtopic-within-a-paper (dashboard study-path order)
//   - module-within-a-subtopic (the hybrid "attempted once AND mastery" rule)
//   - stage-within-a-module (Teach -> Grasp -> Remember -> Test, sequential)
// A fourth gate (adaptive-tier escalation) lives in engine.js instead, since
// it's a pure extension of nextTier's existing escalate/de-escalate logic.

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// A subtopic's PYQ marks range 10-20 (see lib/ai/generateQuestion.js's
// allowedMarks) -- normalizes average marks onto the same 0-1 scale as
// sourceAdvancedness below, so the two signals can be averaged directly.
const MIN_PYQ_MARKS = 10;
const MAX_PYQ_MARKS = 20;

/**
 * Source-tier-composition half of the difficulty score: a subtopic grounded
 * mainly in NCERT sources is foundational; one leaning on current-affairs/
 * govt/external sources is advanced. Falls back to neutral (0.5) when there's
 * no source data yet, rather than skewing the score on absence of data.
 */
export function sourceAdvancedness(sourceBucket) {
  return sourceBucket && sourceBucket.total > 0 ? 1 - sourceBucket.ncert / sourceBucket.total : 0.5;
}

/**
 * Real-PYQ-marks half of the difficulty score: higher-mark UPSC questions
 * tend to be more analytical/synthesis-level, lower-mark ones more
 * direct-recall. Falls back to the midpoint (15 marks -> 0.5) when a
 * subtopic has no real PYQs yet.
 */
export function pyqAdvancedness(pyqMarksList) {
  const avgMarks = pyqMarksList && pyqMarksList.length ? pyqMarksList.reduce((a, b) => a + b, 0) / pyqMarksList.length : 15;
  return Math.min(1, Math.max(0, (avgMarks - MIN_PYQ_MARKS) / (MAX_PYQ_MARKS - MIN_PYQ_MARKS)));
}

/**
 * Basics-to-advanced score (0 = most foundational, 1 = most advanced), moved
 * verbatim from app/api/subtopics/route.js's original private implementation
 * so the dashboard and the server-side lock-enforcement layer share one
 * computation instead of two copies that can drift.
 */
export function computeDifficultyScore(sourceBucket, pyqMarksList) {
  return (sourceAdvancedness(sourceBucket) + pyqAdvancedness(pyqMarksList)) / 2;
}

/**
 * Study-path order within a paper: basics -> advanced, pyqFrequency as a
 * tie-breaker among similarly-difficult subtopics (surfaces higher-yield
 * ones first), subtopic id as a final deterministic tie-breaker. Expects
 * items already carrying a `difficultyScore` field (from computeDifficultyScore).
 */
export function orderSubtopicsWithinPaper(subtopicsWithScore) {
  return [...subtopicsWithScore].sort(
    (a, b) => a.difficultyScore - b.difficultyScore || b.pyqFrequency - a.pyqFrequency || a.id.localeCompare(b.id)
  );
}

// 60% for both subtopic-chain and module-chain unlocks -- sits between
// engine.js's own escalate/de-escalate cutoffs (0.75/0.45), demanding more
// than "not weak" without requiring the "strong" bar that already triggers
// tier escalation on its own.
export const MASTERY_UNLOCK_THRESHOLD = 0.6;

/**
 * Subtopic-chain locks within one already-ordered paper: the first subtopic
 * is always unlocked; subtopic N+1 needs subtopic N's masteryScore to clear
 * the threshold. Returns a Map<subtopicId, lockInfo>.
 */
export function computeSubtopicLocks(orderedSubtopics, masteryScoreById, threshold = MASTERY_UNLOCK_THRESHOLD) {
  const map = new Map();
  orderedSubtopics.forEach((s, i) => {
    const requiredMasteryPct = Math.round(threshold * 100);
    if (i === 0) {
      map.set(s.id, { locked: false, requiredSubtopicId: null, requiredSubtopicText: null, requiredMasteryPct, currentMasteryPct: 0 });
      return;
    }
    const prev = orderedSubtopics[i - 1];
    const prevScore = clamp01(masteryScoreById[prev.id] ?? 0);
    const locked = prevScore < threshold;
    map.set(s.id, {
      locked,
      requiredSubtopicId: locked ? prev.id : null,
      requiredSubtopicText: locked ? prev.topicText : null,
      requiredMasteryPct,
      currentMasteryPct: Math.round(prevScore * 100),
    });
  });
  return map;
}

// Stage sequencing within a module: Teach -> Grasp -> Remember -> Test has
// no score to gate on (only Test produces one), so this is a
// sequential-completion gate, not a percent-mastery one.
export const STAGE_ORDER = ["teach", "grasp", "remember", "test"];

export function isStageUnlocked(stage, unlockedStage) {
  return STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf(unlockedStage || "teach");
}

/**
 * A stage only legitimately "advances" one step past the current high-water
 * mark -- fired only by a stage's own Continue button, never by a tab click
 * jumping ahead. Returns true if targetStage is exactly currentUnlockedStage's
 * successor.
 */
export function validateStageAdvance(currentUnlockedStage, targetStage) {
  return STAGE_ORDER.indexOf(targetStage) === STAGE_ORDER.indexOf(currentUnlockedStage || "teach") + 1;
}

/**
 * Module-chain locks (hybrid rule): module 1 is always unlocked. Module N+1
 * unlocks only when BOTH module N's own Test has been attempted at least
 * once (moduleProgressById, keyed by module id as a string -- jsonb keys are
 * always strings) AND the subtopic's masteryScore clears the threshold.
 * `modules` is [{id, orderIndex}] already in order.
 */
export function computeModuleLocks(modules, moduleProgressById, subtopicMasteryScore, threshold = MASTERY_UNLOCK_THRESHOLD) {
  const map = new Map();
  const requiredMasteryPct = Math.round(threshold * 100);
  const currentMasteryPct = Math.round(clamp01(subtopicMasteryScore ?? 0) * 100);
  modules.forEach((m, i) => {
    if (i === 0) {
      map.set(m.id, { locked: false, reason: null, requiredMasteryPct, currentMasteryPct });
      return;
    }
    const prevId = modules[i - 1].id;
    const prevAttempted = (moduleProgressById?.[String(prevId)]?.testAttempts ?? 0) >= 1;
    const masteryOk = clamp01(subtopicMasteryScore ?? 0) >= threshold;
    const reason = !prevAttempted ? "previous_test_not_attempted" : !masteryOk ? "mastery_below_threshold" : null;
    map.set(m.id, { locked: !!reason, reason, requiredMasteryPct, currentMasteryPct });
  });
  return map;
}
