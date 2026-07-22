// db/seed/subjects.js
//
// One row per exam component the app serves content for. "law-optional" was
// originally seeded one-time via app/api/setup/phase1-reset/route.js (see
// the Phase 1 plan) rather than through the ongoing /api/setup seed flow --
// listed here too so it's idempotently upserted going forward the same way
// every other subject is, and so a fresh database (not just the original
// production one) has it from a single /api/setup run.
//
// Every subject except law-optional/gs2 has zero subtopics as of this seed
// -- they exist here purely so the top-level papers index (see
// lib/subjects/papers.js, app/page.jsx) can show the full real UPSC CSE
// exam structure as "coming soon" tiles, not just the papers that already
// have content.
import { getOptionalSubjects, getCompulsoryLanguages } from "../../lib/subjects/papers.js";

export const subjectsSeed = [
  { id: "gs2", displayName: "GS Paper II", category: "gs", examStage: "mains", answerFormat: "descriptive" },
  { id: "gs1", displayName: "GS Paper I", category: "gs", examStage: "mains", answerFormat: "descriptive" },
  { id: "gs3", displayName: "GS Paper III", category: "gs", examStage: "mains", answerFormat: "descriptive" },
  { id: "gs4", displayName: "GS Paper IV", category: "gs", examStage: "mains", answerFormat: "descriptive" },
  { id: "essay", displayName: "Essay", category: "essay", examStage: "mains", answerFormat: "essay" },
  { id: "prelims-gs", displayName: "CSE Prelims — General Studies", category: "prelims", examStage: "prelims", answerFormat: "mcq" },
  { id: "prelims-csat", displayName: "CSE Prelims — CSAT (Quant)", category: "prelims", examStage: "prelims", answerFormat: "mcq" },
  // Qualifying-only Mains paper -- NOT counted toward final merit ranking
  // (need a minimum 25% each just to have the merit papers evaluated at
  // all). Paper A's own 22 language choices are generated below instead --
  // this is only the fixed, no-choice Paper B.
  { id: "english-qualifying", displayName: "Paper B: English Language", category: "qualifying", examStage: "mains", answerFormat: "descriptive" },
  // All 48 real UPSC optional subjects (25 general incl. Law, 23 literature-
  // of-language) and all 22 Eighth-Schedule Paper A language choices,
  // generated from lib/subjects/papers.js's own PAPER_TILES data instead of
  // duplicated here by hand -- avoids the two ever drifting apart. Replaces
  // this file's earlier "law-optional" + generic "literature-optional" +
  // generic "compulsory-language" placeholders (law-optional's displayName
  // below matches exactly what those three lines used to say by hand; the
  // other two were never real single subjects, just early guesses).
  ...getOptionalSubjects().map((s) => ({
    id: s.subjectId,
    displayName: `${s.displayName} Optional`,
    category: "optional",
    examStage: "mains",
    answerFormat: "descriptive",
  })),
  ...getCompulsoryLanguages().map((s) => ({
    id: s.subjectId,
    displayName: `Paper A: ${s.displayName}`,
    category: "qualifying",
    examStage: "mains",
    answerFormat: "descriptive",
  })),
];
