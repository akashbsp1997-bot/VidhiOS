// db/seed/subjects.js
//
// One row per exam component the app serves content for. "law-optional" was
// originally seeded one-time via app/api/setup/phase1-reset/route.js (see
// the Phase 1 plan) rather than through the ongoing /api/setup seed flow --
// listed here too so it's idempotently upserted going forward the same way
// every other subject is, and so a fresh database (not just the original
// production one) has it from a single /api/setup run.
export const subjectsSeed = [
  { id: "law-optional", displayName: "Law Optional", category: "optional", examStage: "mains", answerFormat: "descriptive" },
  { id: "gs2", displayName: "GS Paper II", category: "gs", examStage: "mains", answerFormat: "descriptive" },
];
