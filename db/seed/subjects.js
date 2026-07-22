// db/seed/subjects.js
//
// One row per exam component the app serves content for. "law-optional" was
// originally seeded one-time via app/api/setup/phase1-reset/route.js (see
// the Phase 1 plan) rather than through the ongoing /api/setup seed flow --
// listed here too so it's idempotently upserted going forward the same way
// every other subject is, and so a fresh database (not just the original
// production one) has it from a single /api/setup run.
//
// gs1/gs3/gs4/essay/prelims-gs/prelims-csat/literature-optional/
// compulsory-language/english-qualifying have zero subtopics as of this
// seed -- they exist here purely so the top-level papers index (see
// lib/subjects/papers.js, app/page.jsx) can show the full real UPSC CSE
// exam structure as "coming soon" tiles, not just the papers that already
// have content. law-optional/gs2 are the only ones with real
// subtopics/PYQs/sources today.
export const subjectsSeed = [
  { id: "law-optional", displayName: "Law Optional", category: "optional", examStage: "mains", answerFormat: "descriptive" },
  { id: "gs2", displayName: "GS Paper II", category: "gs", examStage: "mains", answerFormat: "descriptive" },
  { id: "gs1", displayName: "GS Paper I", category: "gs", examStage: "mains", answerFormat: "descriptive" },
  { id: "gs3", displayName: "GS Paper III", category: "gs", examStage: "mains", answerFormat: "descriptive" },
  { id: "gs4", displayName: "GS Paper IV", category: "gs", examStage: "mains", answerFormat: "descriptive" },
  { id: "essay", displayName: "Essay", category: "essay", examStage: "mains", answerFormat: "essay" },
  { id: "prelims-gs", displayName: "CSE Prelims — General Studies", category: "prelims", examStage: "prelims", answerFormat: "mcq" },
  { id: "prelims-csat", displayName: "CSE Prelims — CSAT (Quant)", category: "prelims", examStage: "prelims", answerFormat: "mcq" },
  { id: "literature-optional", displayName: "Literature Optional", category: "optional", examStage: "mains", answerFormat: "descriptive" },
  // Qualifying-only Mains papers -- NOT counted toward final merit ranking
  // (need a minimum 25% each just to have the merit papers evaluated at
  // all). Added per the user's explicit correction of the official Mains
  // structure; this app's first pass at the papers index omitted these two
  // entirely.
  { id: "compulsory-language", displayName: "Paper A: Compulsory Indian Language", category: "qualifying", examStage: "mains", answerFormat: "descriptive" },
  { id: "english-qualifying", displayName: "Paper B: English Language", category: "qualifying", examStage: "mains", answerFormat: "descriptive" },
];
