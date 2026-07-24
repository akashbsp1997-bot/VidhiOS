// lib/adaptive/engine.js
//
// Pure, dependency-free adaptive-learning logic. No DB, no fetch, no React —
// everything here is a plain function of its inputs so it can be unit-tested
// with plain `node` (see the test block run during the build of this repo) and
// so the API routes that wrap it stay thin and easy to audit.
//
// The model in one paragraph: each subtopic has a `mastery` score (0-1) and a
// `tier` (1-3, how hard the questions it's served should be). Every answered
// question nudges mastery toward the score it just earned, and two good/bad
// answers in a row nudge the tier up/down. Which subtopic to serve next is a
// weighted lottery that favours low-mastery, high-PYQ-frequency topics without
// ever fully benching a mastered one — so weak areas get the most reps, strong
// areas still get occasional harder reps ("making strong areas stronger"),
// and none of it needed to be a black box to make that happen.

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function clampTier(t) {
  return Math.max(1, Math.min(3, Math.round(t)));
}

/**
 * Updates a subtopic's running mastery estimate after one graded attempt.
 * Learning rate K starts high (new/thin-data topics move fast) and settles to
 * a floor of 0.15 (so mastery never goes fully rigid, since the underlying
 * signal — an AI-graded essay score — is itself approximate, not a clean
 * psychometric response).
 */
export function updateMastery(masteryOld, attemptsSoFar, score01) {
  const K = Math.min(0.6, Math.max(0.15, 1 / (1 + attemptsSoFar)));
  return clamp01(masteryOld + K * (score01 - masteryOld));
}

/**
 * Appends a score to a capped recent-scores window (newest last).
 */
export function pushRecentScore(recentScores, score01, maxLen = 5) {
  const next = [...(recentScores || []), score01];
  return next.slice(-maxLen);
}

/**
 * Difficulty ladder: two strong answers in a row escalate, two weak answers
 * in a row de-escalate, anything mixed holds. Only looks at the most recent
 * two so one lucky/unlucky answer can't swing it.
 *
 * `masteryScore` is optional (omitting it reproduces the exact pre-existing
 * behavior, so old callers/tests are unaffected) -- when given, an
 * escalation is additionally held back unless masteryScore clears the
 * target tier's floor (see TIER_MASTERY_FLOOR), so the difficulty *number*
 * genuinely tracks mastery rather than just two recent lucky answers. This
 * never blocks a de-escalation or a hold.
 *
 * Lowered from the original 0.6/0.8 -- two strong recent answers plus a
 * still-fairly-low mastery floor was blocking tier escalation more than
 * intended in practice; this keeps the gate (mastery still has to be
 * genuinely trending up, not just two lucky answers) without demanding
 * near-mastery before a student ever sees a harder question.
 */
export const TIER_MASTERY_FLOOR = { 2: 0.3, 3: 0.5 };

export function nextTier(currentTier, recentScores01, masteryScore) {
  const last2 = (recentScores01 || []).slice(-2);
  let candidate = clampTier(currentTier);
  if (last2.length === 2 && last2.every((s) => s >= 0.75)) {
    candidate = clampTier(currentTier + 1);
  } else if (last2.length === 2 && last2.every((s) => s < 0.45)) {
    candidate = clampTier(currentTier - 1);
  }

  if (candidate > clampTier(currentTier) && typeof masteryScore === "number") {
    const floor = TIER_MASTERY_FLOOR[candidate];
    if (floor && masteryScore < floor) return clampTier(currentTier);
  }
  return candidate;
}

/**
 * Companion to nextTier: lets a caller explain to the student *why* a tier
 * held despite two strong recent answers, instead of that just looking like
 * nothing happened. Returns null when escalation wasn't held back for a
 * mastery-floor reason (including when masteryScore wasn't provided at all).
 */
export function tierEscalationBlockedInfo(currentTier, recentScores01, masteryScore) {
  const last2 = (recentScores01 || []).slice(-2);
  const wouldEscalate = last2.length === 2 && last2.every((s) => s >= 0.75);
  if (!wouldEscalate || typeof masteryScore !== "number") return null;
  const candidate = clampTier(currentTier + 1);
  const floor = TIER_MASTERY_FLOOR[candidate];
  if (!floor || masteryScore >= floor) return null;
  return { heldAtTier: clampTier(currentTier), requiredMasteryPct: Math.round(floor * 100), currentMasteryPct: Math.round(masteryScore * 100) };
}

/**
 * Weighted-random pick of which subtopic to serve next.
 * `subtopicStates`: [{ id, mastery(0-1), pyqFrequency(int) }]
 * Weight = frequency-with-diminishing-returns x weakness (never fully zero,
 * so mastered topics keep a small residual chance — they surface at their
 * now-higher tier, which is what actually strengthens a strong area).
 */
export function chooseSubtopic(subtopicStates, rng = Math.random) {
  if (!subtopicStates.length) return null;
  const weights = subtopicStates.map((s) => {
    const freqWeight = 1 + Math.log2(1 + Math.max(0, s.pyqFrequency || 0));
    const weaknessWeight = Math.pow(1 - clamp01(s.mastery), 1.5) + 0.05;
    return freqWeight * weaknessWeight;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < subtopicStates.length; i++) {
    r -= weights[i];
    if (r <= 0) return subtopicStates[i].id;
  }
  return subtopicStates[subtopicStates.length - 1].id;
}

/**
 * Decides what to serve next within an already-chosen subtopic. Real PYQs
 * are no longer a servable source here (2026-07-24 "content-first" change) —
 * outside mock tests, a real PYQ is used only as a generation REFERENCE fed
 * into the prompt (see lib/ai/contentGrounding.js's pickReferencePyqs and
 * lib/ai/generateQuestion.js), never served as the question itself. This
 * function's job shrinks to "prefer an unseen cached model question at this
 * tier, else the caller must generate one."
 *
 *  - seenQuestionRefIds: array of model-question ids already answered for
 *    this subtopic, so we prefer fresh ones.
 *  - modelPool: [{ id, difficultyTier }] previously-generated model questions
 *    tagged to this subtopic.
 *
 * Returns one of:
 *   { source: "model", id }
 *   { source: "generate", difficultyTier }   caller must AI-generate one,
 *                                             save it, then serve it.
 */
export function chooseQuestionPlan({ tier, seenQuestionRefIds, modelPool, rng = Math.random }) {
  const seen = new Set((seenQuestionRefIds || []).map(String));

  const tierModelPool = (modelPool || []).filter((q) => q.difficultyTier === clampTier(tier));
  const unseenModel = tierModelPool.filter((q) => !seen.has(String(q.id)));
  const modelCandidates = unseenModel.length ? unseenModel : tierModelPool;

  if (!modelCandidates.length) return { source: "generate", difficultyTier: clampTier(tier) };
  const idx = Math.floor(rng() * modelCandidates.length);
  return { source: "model", id: modelCandidates[idx].id };
}

/**
 * Top-level orchestration: given full state, decide the next subtopic AND
 * the next question plan in one call. DB-agnostic — the API route loads the
 * inputs and persists the outputs. (Currently unused by any route — the
 * route reimplements this inline — kept in sync with chooseQuestionPlan's
 * signature for consistency.)
 */
export function planNextQuestion({ subtopicStates, forcedSubtopicId, tierBySubtopic, seenBySubtopic, modelQuestionsBySubtopic, rng = Math.random }) {
  const subtopicId = forcedSubtopicId || chooseSubtopic(subtopicStates, rng);
  if (!subtopicId) return null;
  const tier = tierBySubtopic[subtopicId] || 1;
  const plan = chooseQuestionPlan({
    tier,
    seenQuestionRefIds: seenBySubtopic[subtopicId] || [],
    modelPool: modelQuestionsBySubtopic[subtopicId] || [],
    rng,
  });
  return { subtopicId, tier, ...plan };
}
