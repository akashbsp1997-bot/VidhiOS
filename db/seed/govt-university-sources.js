// db/seed/govt-university-sources.js
//
// Real IGNOU (Indira Gandhi National Open University -- a Government of
// India central university) Self Learning Material, hosted on its own
// official open-access repository, eGyankosh (egyankosh.ac.in) -- no
// login/paywall, built for free public educational reading. Filling
// exactly the gap db/seed/ncert-sources.js's own header flagged and
// couldn't fill: GS4 (Ethics) was never an NCERT subject at all, and GS3's
// Internal Security/Science & Technology sections have no NCERT textbook
// either. IGNOU's MA Public Administration (MPA) and MA Political Science
// (MPS) programs cover ethics-in-governance and IR theory directly, at
// exactly the depth this app's PG-level optional (PSIR) and GS4 need.
//
// sourceTier: 'official' (fetchable/cacheable in full, same tier as PIB/
// India Code/court sites already in this app) -- NOT 'private_vendor'.
// This is govt-university-published material on an open platform, a
// categorically different thing from a coaching company selling notes
// (see lib/sources/tiers.js's header on why that distinction is the one
// that actually matters here, not file format or price).
//
// Every (title, url, handle) below was verified via live web search
// against egyankosh.ac.in itself (2026-07-24) -- real IGNOU course/unit
// pages, not guessed handle numbers. Deliberately NOT exhaustive: GS4 goes
// from 0/21 to partial coverage here, not full -- several narrower GS4
// subtopics (e.g. probity/RTI/codes of conduct, emotional intelligence,
// ethics in international relations) didn't turn up a specific verified
// unit in this pass, an honest gap rather than a guessed URL. GS3's
// Science & Technology and Internal Security sections are STILL entirely
// uncovered -- the IGNOU disaster-management units this search turned up
// belong to GS3's separate (already NCERT-covered) "Environment and
// Disaster Management" section, not Internal Security, and mapping them
// there anyway would be exactly the kind of forced mismatch this app
// avoids elsewhere. Left for a future, more targeted pass.
const ENTRIES = [
  {
    title: "MPYE-002: Ethics (IGNOU MA Philosophy)",
    url: "https://egyankosh.ac.in/handle/123456789/4774",
    subtopicIds: ["gs4-e1", "gs4-e2", "gs4-a4"],
  },
  {
    title: "Unit-1: An Introduction to Ethics (IGNOU)",
    url: "https://egyankosh.ac.in/handle/123456789/38230",
    subtopicIds: ["gs4-e1"],
  },
  {
    title: "Unit-14: Ethics and Morality (IGNOU)",
    url: "https://egyankosh.ac.in/handle/123456789/78429",
    subtopicIds: ["gs4-e1", "gs4-e2"],
  },
  {
    title: "Unit-12: Professional Values and Ethics (IGNOU)",
    url: "https://egyankosh.ac.in/handle/123456789/8615",
    subtopicIds: ["gs4-e3", "gs4-g1"],
  },
  {
    title: "Unit-7: Attitudes and Values (IGNOU)",
    url: "https://egyankosh.ac.in/handle/123456789/12206",
    subtopicIds: ["gs4-e6"],
  },
  {
    title: "Unit-21: Administrative Ethics and Integrity in Civil Services (IGNOU)",
    url: "https://egyankosh.ac.in/handle/123456789/19286",
    subtopicIds: ["gs4-a1", "gs4-g1", "gs4-g4"],
  },
  {
    title: "Unit-21: Ethical Concerns in Public Administration (IGNOU MPA)",
    url: "https://egyankosh.ac.in/handle/123456789/25253",
    subtopicIds: ["gs4-g1", "gs4-g2"],
  },
  {
    title: "MPS-002: International Relations — Theory and Problems (IGNOU MA Political Science)",
    url: "https://egyankosh.ac.in/handle/123456789/5490",
    subtopicIds: ["psir-ir1", "psir-ir2"],
  },
  {
    title: "Unit-3: State System, Power, National Interest, Security (IGNOU)",
    url: "https://egyankosh.ac.in/handle/123456789/20746",
    subtopicIds: ["psir-ir2"],
  },
];

export const govtUniversitySourcesSeed = ENTRIES.flatMap((entry) =>
  entry.subtopicIds.map((subtopicId) => ({
    subtopicId,
    title: entry.title,
    url: entry.url,
    sourceType: "other",
    official: true,
    sourceTier: "official",
  }))
);
