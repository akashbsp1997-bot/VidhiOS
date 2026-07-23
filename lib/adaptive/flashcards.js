// lib/adaptive/flashcards.js
//
// Derives flashcards from content a real Teach/Grasp visit already
// generated -- lessons.keyProvisions/caseLaw/mnemonics (legacy flow) and
// lessonModules.keyPoints/mnemonic (module flow) -- never generates
// anything new, same "reuse existing data" principle as
// lib/subjects/themeGuide.js. Cards are recomputed fresh on every fetch
// rather than stored; each card's `id` is deterministic so
// lib/adaptive/srs.js's per-card review state (flashcard_reviews table)
// stays stable across re-derivations of the same underlying content.

/**
 * @param {string} subtopicId
 * @param {string} subtopicText
 * @param {{keyProvisions?: {citation,summary}[], caseLaw?: {case,significance,holding}[], mnemonics?: {device,explanation}[]}} lesson
 */
export function cardsFromLesson(subtopicId, subtopicText, lesson) {
  const cards = [];
  (lesson.keyProvisions ?? []).forEach((p, i) => {
    if (p?.citation && p?.summary) cards.push({ id: `lesson:${subtopicId}:kp:${i}`, subtopicId, subtopicText, front: p.citation, back: p.summary });
  });
  (lesson.caseLaw ?? []).forEach((c, i) => {
    const back = c?.significance || c?.holding;
    if (c?.case && back) cards.push({ id: `lesson:${subtopicId}:cl:${i}`, subtopicId, subtopicText, front: c.case, back });
  });
  (lesson.mnemonics ?? []).forEach((m, i) => {
    if (m?.device && m?.explanation) cards.push({ id: `lesson:${subtopicId}:mn:${i}`, subtopicId, subtopicText, front: m.device, back: m.explanation });
  });
  return cards;
}

/**
 * @param {string} subtopicId
 * @param {string} subtopicText
 * @param {{id, title, keyPoints?: string[], mnemonic?: {device,explanation}|null}} moduleRow
 */
export function cardsFromModule(subtopicId, subtopicText, moduleRow) {
  const cards = [];
  const label = moduleRow.title ? `${subtopicText} — ${moduleRow.title}` : subtopicText;
  (moduleRow.keyPoints ?? []).forEach((kp, i) => {
    if (typeof kp === "string" && kp.trim()) {
      cards.push({ id: `module:${moduleRow.id}:kp:${i}`, subtopicId, subtopicText: label, front: `Key point — ${moduleRow.title}`, back: kp });
    }
  });
  if (moduleRow.mnemonic?.device && moduleRow.mnemonic?.explanation) {
    cards.push({ id: `module:${moduleRow.id}:mn`, subtopicId, subtopicText: label, front: moduleRow.mnemonic.device, back: moduleRow.mnemonic.explanation });
  }
  return cards;
}
