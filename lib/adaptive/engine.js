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
 */
export function nextTier(currentTier, recentScores01) {
  const last2 = (recentScores01 || []).slice(-2);
  if (last2.length === 2 && last2.every((s) => s >= 0.75)) {
    return clampTier(currentTier + 1);
  }
  if (last2.length === 2 && last2.every((s) => s < 0.45)) {
    return clampTier(currentTier - 1);
  }
  return clampTier(currentTier);
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
 * PYQ/model mix ratio by tier — the literal "mix of pyq and model questions
 * that are slightly tougher" the app was asked to do. Tier 1 leans on real
 * past papers; tier 3 leans on generated analytical/synthesis questions,
 * since by definition few real PYQs are harder than the real PYQ ceiling.
 */
const PYQ_WEIGHT_BY_TIER = { 1: 0.7, 2: 0.45, 3: 0.15 };

/**
 * Decides what to serve next within an already-chosen subtopic.
 *
 *  - seenQuestionRefIds: array of question ids (pyq or model) already
 *    answered for this subtopic, so we prefer fresh ones.
 *  - pyqPool: [{ id, marks }] PYQs tagged to this subtopic.
 *  - modelPool: [{ id, difficultyTier }] previously-generated model questions
 *    tagged to this subtopic.
 *
 * Returns one of:
 *   { source: "pyq", id }
 *   { source: "model", id }
 *   { source: "generate", difficultyTier }   caller must AI-generate one,
 *                                             save it, then serve it.
 */
export function chooseQuestionPlan({ tier, seenQuestionRefIds, pyqPool, modelPool, rng = Math.random }) {
  const seen = new Set((seenQuestionRefIds || []).map(String));
  const pyqWeight = PYQ_WEIGHT_BY_TIER[clampTier(tier)] ?? 0.5;

  const unseenPyqs = (pyqPool || []).filter((q) => !seen.has(String(q.id)));
  const pyqCandidates = unseenPyqs.length ? unseenPyqs : pyqPool || [];
  // Prefer higher-mark (harder/more analytical) PYQs once past tier 1.
  const sortedPyqs = [...pyqCandidates].sort((a, b) =>
    tier === 1 ? a.marks - b.marks : b.marks - a.marks
  );

  const tierModelPool = (modelPool || []).filter((q) => q.difficultyTier === clampTier(tier));
  const unseenModel = tierModelPool.filter((q) => !seen.has(String(q.id)));
  const modelCandidates = unseenModel.length ? unseenModel : tierModelPool;

  const wantPyq = rng() < pyqWeight;

  function pickPyq() {
    if (!sortedPyqs.length) return null;
    // pick from the top half of the sorted (harder-first, once tier>1) pool for variety
    const topHalf = Math.max(1, Math.ceil(sortedPyqs.length / 2));
    const idx = Math.floor(rng() * topHalf);
    return { source: "pyq", id: sortedPyqs[idx].id };
  }
  function pickModel() {
    if (!modelCandidates.length) return null;
    const idx = Math.floor(rng() * modelCandidates.length);
    return { source: "model", id: modelCandidates[idx].id };
  }

  // Each preferred bucket only falls through to the OTHER bucket if its own
  // pool is completely empty (not merely "nothing cached at this tier yet") —
  // wanting a model question and finding none cached is exactly the signal
  // to generate one, not a reason to quietly serve a pyq instead. This is
  // what keeps the model-question pool actually growing over time instead of
  // the app silently defaulting to all-PYQ forever.
  if (wantPyq) {
    return pickPyq() || pickModel() || { source: "generate", difficultyTier: clampTier(tier) };
  }
  return pickModel() || { source: "generate", difficultyTier: clampTier(tier) };
}

/**
 * Top-level orchestration: given full state, decide the next subtopic AND
 * the next question plan in one call. DB-agnostic — the API route loads the
 * inputs and persists the outputs.
 */
export function planNextQuestion({ subtopicStates, forcedSubtopicId, tierBySubtopic, seenBySubtopic, pyqsBySubtopic, modelQuestionsBySubtopic, rng = Math.random }) {
  const subtopicId = forcedSubtopicId || chooseSubtopic(subtopicStates, rng);
  if (!subtopicId) return null;
  const tier = tierBySubtopic[subtopicId] || 1;
  const plan = chooseQuestionPlan({
    tier,
    seenQuestionRefIds: seenBySubtopic[subtopicId] || [],
    pyqPool: pyqsBySubtopic[subtopicId] || [],
    modelPool: modelQuestionsBySubtopic[subtopicId] || [],
    rng,
  });
  return { subtopicId, tier, ...plan };
}
