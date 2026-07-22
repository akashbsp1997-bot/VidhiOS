// lib/subjects/papers.js
//
// Static definition of every real UPSC CSE paper the top-level dashboard
// (app/page.jsx) enumerates as a tile -- independent of which ones actually
// have subtopics/content yet (see db/seed/subjects.js for the matching
// `subjects` rows). A paper with zero subtopics renders as a "coming soon"
// tile rather than being hidden, per explicit product choice: the full exam
// structure should be visible now, real content added paper by paper later.
//
// GS papers, Essay, and both Prelims papers are each a single paper on their
// own (subtopics.paper is always 1 for those, same as gs2's existing seed).
// The two optional subjects (Law, Literature) each genuinely split into
// Paper I / Paper II, matching subtopics.paper's existing 1-or-2 semantics
// for law-optional's own syllabus (31 Paper I topics, 50 Paper II topics).
//
// Pure data, DB-free -- safe to import from a client component (app/page.jsx,
// app/papers/[subjectId]/[paper]/page.jsx) as well as a server route
// (app/api/papers/route.js), same house convention as lib/adaptive/unlocks.js.
export const PAPER_TILES = [
  { group: "CSE Prelims", subjectId: "prelims-gs", paper: 1, label: "General Studies" },
  { group: "CSE Prelims", subjectId: "prelims-csat", paper: 1, label: "CSAT (Quant)" },
  { group: "CSE Mains — General Studies", subjectId: "gs1", paper: 1, label: "GS Paper I" },
  { group: "CSE Mains — General Studies", subjectId: "gs2", paper: 1, label: "GS Paper II" },
  { group: "CSE Mains — General Studies", subjectId: "gs3", paper: 1, label: "GS Paper III" },
  { group: "CSE Mains — General Studies", subjectId: "gs4", paper: 1, label: "GS Paper IV" },
  { group: "CSE Mains", subjectId: "essay", paper: 1, label: "Essay" },
  { group: "CSE Mains — Optional: Literature", subjectId: "literature-optional", paper: 1, label: "Paper I" },
  { group: "CSE Mains — Optional: Literature", subjectId: "literature-optional", paper: 2, label: "Paper II" },
  { group: "CSE Mains — Optional: Law", subjectId: "law-optional", paper: 1, label: "Paper I" },
  { group: "CSE Mains — Optional: Law", subjectId: "law-optional", paper: 2, label: "Paper II" },
];

export function findPaperTile(subjectId, paper) {
  return PAPER_TILES.find((t) => t.subjectId === subjectId && t.paper === paper) || null;
}
