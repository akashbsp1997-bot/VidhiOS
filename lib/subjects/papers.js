// lib/subjects/papers.js
//
// Static definition of every real UPSC CSE paper the top-level dashboard
// (app/page.jsx) enumerates as a tile -- independent of which ones actually
// have subtopics/content yet (see db/seed/subjects.js for the matching
// `subjects` rows). A paper with zero subtopics renders as a "coming soon"
// tile rather than being hidden, per explicit product choice: the full exam
// structure should be visible now, real content added paper by paper later.
//
// GS papers, Essay, both qualifying papers, and both Prelims papers are each
// a single paper on their own (subtopics.paper is always 1 for those, same
// as gs2's existing seed). The two optional subjects (Law, Literature) each
// genuinely split into Paper I / Paper II, matching subtopics.paper's
// existing 1-or-2 semantics for law-optional's own syllabus (31 Paper I
// topics, 50 Paper II topics).
//
// Mains structure below is the REAL official one (paper letters/numbers,
// marks, qualifying-vs-merit split) per the user's explicit correction --
// this app's first pass at this list had guessed a simplified GS-I-IV +
// Essay + Optional structure and entirely omitted the two qualifying
// language papers. `marks` and `qualifying` are only set where the user
// actually supplied them (the Mains papers); left unset on the two Prelims
// entries below rather than guessed.
//
// Pure data, DB-free -- safe to import from a client component (app/page.jsx,
// app/papers/[subjectId]/[paper]/page.jsx) as well as a server route
// (app/api/papers/route.js), same house convention as lib/adaptive/unlocks.js.
export const PAPER_TILES = [
  { group: "CSE Prelims", subjectId: "prelims-gs", paper: 1, label: "General Studies" },
  { group: "CSE Prelims", subjectId: "prelims-csat", paper: 1, label: "CSAT (Quant)" },

  // Qualifying only -- NOT counted toward final merit ranking. A minimum
  // 25% in EACH is required before the merit-based papers below are even
  // evaluated.
  {
    group: "CSE Mains — Qualifying",
    subjectId: "compulsory-language",
    paper: 1,
    label: "Paper A: Compulsory Indian Language",
    marks: 300,
    qualifying: true,
  },
  { group: "CSE Mains — Qualifying", subjectId: "english-qualifying", paper: 1, label: "Paper B: English Language", marks: 300, qualifying: true },

  // Merit-based -- counted for final ranking, official Paper I-VII numbering.
  { group: "CSE Mains — Merit", subjectId: "essay", paper: 1, label: "Paper I: Essay", marks: 250 },
  { group: "CSE Mains — Merit", subjectId: "gs1", paper: 1, label: "Paper II: GS I", marks: 250 },
  { group: "CSE Mains — Merit", subjectId: "gs2", paper: 1, label: "Paper III: GS II", marks: 250 },
  { group: "CSE Mains — Merit", subjectId: "gs3", paper: 1, label: "Paper IV: GS III", marks: 250 },
  { group: "CSE Mains — Merit", subjectId: "gs4", paper: 1, label: "Paper V: GS IV", marks: 250 },
  {
    group: "CSE Mains — Merit — Optional: Literature",
    subjectId: "literature-optional",
    paper: 1,
    label: "Paper VI: Optional Paper 1",
    marks: 250,
  },
  {
    group: "CSE Mains — Merit — Optional: Literature",
    subjectId: "literature-optional",
    paper: 2,
    label: "Paper VII: Optional Paper 2",
    marks: 250,
  },
  { group: "CSE Mains — Merit — Optional: Law", subjectId: "law-optional", paper: 1, label: "Paper VI: Optional Paper 1", marks: 250 },
  { group: "CSE Mains — Merit — Optional: Law", subjectId: "law-optional", paper: 2, label: "Paper VII: Optional Paper 2", marks: 250 },
];

export function findPaperTile(subjectId, paper) {
  return PAPER_TILES.find((t) => t.subjectId === subjectId && t.paper === paper) || null;
}
