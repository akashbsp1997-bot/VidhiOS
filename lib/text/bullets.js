// lib/text/bullets.js
//
// Splits a Teach/Grasp/Practice text field into individual bullet lines.
// Handles both the current bullet-per-line format (lib/ai/generateLesson.js's
// buildCoreSystem etc. -- each line already starts with "- ") and older
// cached rows still stored as "\n\n"-separated paragraphs: split("\n") +
// filter(Boolean) turns each paragraph into one list item too (the blank
// line between them is exactly what filter(Boolean) drops), so nothing needs
// a migration to render either way.
//
// Extracted out of components/LegacyLearnFlow.jsx and
// components/ModuleLearnFlow.jsx (which used to each define this
// identically) so app/api/answer-architect/route.js (server-side) can reuse
// the exact same splitting logic instead of a third copy.
export function bulletLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean);
}
