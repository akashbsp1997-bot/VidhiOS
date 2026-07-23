// lib/subjects/themeGuide.js
//
// Piece C of the "1-year strategy" request: a subject-wise guide across the
// GS papers -- Polity, History, Geography, Economy, Environment, Ethics,
// etc. Per explicit earlier scoping ("reuse existing data"), this doesn't
// invent a new taxonomy: it groups by each subtopic's own `section` field,
// which already IS that thematic breakdown (see db/seed/gs2-syllabus.js --
// GS2's subtopics are already tagged "Constitution, Polity and Governance
// Institutions" / "Governance, Social Justice and Welfare" /
// "International Relations"). Pure, DB-free -- app/api/theme-guide/route.js
// supplies the enriched subtopic data (mastery, sources, existing generated
// notes) and calls this to group/order it.

import { orderSubtopicsWithinPaper } from "../adaptive/unlocks.js";

/**
 * subtopics: [{ id, section, difficultyScore, pyqFrequency, masteryScore,
 * ... }]. Returns one entry per distinct `section` value present, each
 * ordered basics-first (same convention as a per-paper subtopic list),
 * alphabetical by theme name for a stable page order.
 */
export function groupByTheme(subtopics) {
  const bySection = {};
  for (const s of subtopics) {
    (bySection[s.section] ??= []).push(s);
  }
  return Object.entries(bySection)
    .map(([theme, items]) => {
      const ordered = orderSubtopicsWithinPaper(items);
      const avgMastery = ordered.reduce((sum, s) => sum + s.masteryScore, 0) / ordered.length;
      return { theme, subtopics: ordered, avgMastery };
    })
    .sort((a, b) => a.theme.localeCompare(b.theme));
}
