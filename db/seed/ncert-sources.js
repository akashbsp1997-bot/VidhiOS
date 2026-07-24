// db/seed/ncert-sources.js
//
// Real NCERT book references for GS1/GS2/GS3, CSAT quant, and the Political
// Science optional -- book-level, not chapter-level: each entry names a real,
// verified NCERT textbook (title, class, subject) and attaches it to every
// subtopic that book genuinely covers. Verified against NCERT's own
// official catalog during research (2026-07-23), not guessed from memory
// alone -- these are long-stable, well-known titles (Class 11-12 titles in
// particular have been unchanged for years), but every one was
// cross-checked, not assumed.
//
// url points at NCERT's official textbook portal (https://ncert.nic.in/textbook.php)
// rather than a guessed deep link to a specific chapter PDF -- that portal
// page is a real, stable, official page a student can navigate from to the
// exact book, and a wrong guessed deep-link would be worse than an honest
// one-more-click landing page. sourceTier:'ncert' + ncertClass feed
// directly into the existing difficulty-scoring system (see
// lib/adaptive/unlocks.js's sourceScore).
//
// Deliberately NOT exhaustive: GS4 (Ethics) has no real NCERT mapping --
// ethics/aptitude was never an NCERT subject -- and GS3's Internal
// Security section similarly has no NCERT content to point at (no
// textbook covers border security/terrorism/organized crime). GS4 now has
// partial coverage from real IGNOU material instead (see
// db/seed/govt-university-sources.js); Internal Security still needs
// non-NCERT official sources (govt reports, ARC, MHA material) in a
// future pass, not fabricated NCERT citations to fill a gap that's
// genuinely not NCERT's to fill. GS3's Science & Technology section (no
// mapping in earlier revisions of this file) is now covered below by the
// Science/Physics/Chemistry/Biology entries; CSAT's Basic Numeracy is
// covered by the Mathematics entries.
const NCERT_PORTAL_URL = "https://ncert.nic.in/textbook.php";

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const NCERT_ENTRIES = [
  // --- GS1: Indian Heritage and Culture, History, Society, Geography ---
  {
    subtopicIds: ["gs1-c1", "gs1-c2", "gs1-c3"],
    ncertBook: "An Introduction to Indian Art – Part I",
    ncertClass: 11,
    ncertSubject: "Fine Arts",
  },
  {
    subtopicIds: ["gs1-h1", "gs1-h2", "gs1-h3"],
    ncertBook: "Themes in Indian History – Part III",
    ncertClass: 12,
    ncertSubject: "History",
  },
  {
    subtopicIds: ["gs1-wh1", "gs1-wh2", "gs1-wh3", "gs1-wh4", "gs1-wh5"],
    ncertBook: "Themes in World History",
    ncertClass: 11,
    ncertSubject: "History",
  },
  {
    subtopicIds: ["gs1-s1", "gs1-s2", "gs1-s3", "gs1-s4", "gs1-s5", "gs1-s6", "gs1-s7", "gs1-s8"],
    ncertBook: "Indian Society",
    ncertClass: 12,
    ncertSubject: "Sociology",
  },
  {
    subtopicIds: ["gs1-s1", "gs1-s2", "gs1-s3", "gs1-s4", "gs1-s5", "gs1-s6", "gs1-s7", "gs1-s8"],
    ncertBook: "Social Change and Development in India",
    ncertClass: 12,
    ncertSubject: "Sociology",
  },
  {
    subtopicIds: ["gs1-g1", "gs1-g2", "gs1-g3"],
    ncertBook: "Fundamentals of Physical Geography",
    ncertClass: 11,
    ncertSubject: "Geography",
  },
  {
    subtopicIds: ["gs1-g1", "gs1-g2", "gs1-g3"],
    ncertBook: "Fundamentals of Human Geography",
    ncertClass: 12,
    ncertSubject: "Geography",
  },
  {
    subtopicIds: ["gs1-g4", "gs1-g5"],
    ncertBook: "Fundamentals of Physical Geography",
    ncertClass: 11,
    ncertSubject: "Geography",
  },

  // --- GS2: Polity, Governance, International Relations (previously had zero seeded sources) ---
  {
    subtopicIds: ["gs2-c1", "gs2-c2", "gs2-c3", "gs2-c4", "gs2-c5", "gs2-c6", "gs2-c7", "gs2-c8", "gs2-c9"],
    ncertBook: "Democratic Politics I",
    ncertClass: 9,
    ncertSubject: "Political Science",
  },
  {
    subtopicIds: ["gs2-c1", "gs2-c2", "gs2-c3", "gs2-c4", "gs2-c5", "gs2-c6", "gs2-c7", "gs2-c8", "gs2-c9"],
    ncertBook: "Democratic Politics II",
    ncertClass: 10,
    ncertSubject: "Political Science",
  },
  {
    subtopicIds: ["gs2-c1", "gs2-c2", "gs2-c3", "gs2-c4", "gs2-c5", "gs2-c6", "gs2-c7", "gs2-c8", "gs2-c9"],
    ncertBook: "Indian Constitution at Work",
    ncertClass: 11,
    ncertSubject: "Political Science",
  },
  {
    subtopicIds: ["gs2-g1", "gs2-g2", "gs2-g3", "gs2-g4", "gs2-g5", "gs2-g6", "gs2-g7"],
    ncertBook: "Politics in India Since Independence",
    ncertClass: 12,
    ncertSubject: "Political Science",
  },
  {
    subtopicIds: ["gs2-ir1", "gs2-ir2", "gs2-ir3", "gs2-ir4"],
    ncertBook: "Contemporary World Politics",
    ncertClass: 12,
    ncertSubject: "Political Science",
  },

  // --- GS3: Indian Economy, Agriculture, Industry, Environment ---
  {
    subtopicIds: ["gs3-e1", "gs3-e2", "gs3-e3"],
    ncertBook: "Indian Economic Development",
    ncertClass: 11,
    ncertSubject: "Economics",
  },
  {
    subtopicIds: ["gs3-e1", "gs3-e2", "gs3-e3"],
    ncertBook: "Introductory Macroeconomics",
    ncertClass: 12,
    ncertSubject: "Economics",
  },
  {
    subtopicIds: ["gs3-a1", "gs3-a2", "gs3-a3", "gs3-a4", "gs3-a5", "gs3-a6", "gs3-a7"],
    ncertBook: "Indian Economic Development",
    ncertClass: 11,
    ncertSubject: "Economics",
  },
  {
    subtopicIds: ["gs3-i1", "gs3-i2", "gs3-i3"],
    ncertBook: "Indian Economic Development",
    ncertClass: 11,
    ncertSubject: "Economics",
  },
  {
    subtopicIds: ["gs3-env1", "gs3-env2"],
    ncertBook: "Fundamentals of Human Geography",
    ncertClass: 12,
    ncertSubject: "Geography",
  },

  // --- Political Science and International Relations Optional ---
  {
    subtopicIds: [
      "psir-pt1", "psir-pt2", "psir-pt3", "psir-pt4", "psir-pt5",
      "psir-pt6", "psir-pt7", "psir-pt8", "psir-pt9", "psir-pt10",
    ],
    ncertBook: "Political Theory",
    ncertClass: 11,
    ncertSubject: "Political Science",
  },
  {
    subtopicIds: [
      "psir-igp1", "psir-igp2", "psir-igp3", "psir-igp4", "psir-igp5", "psir-igp6",
      "psir-igp7", "psir-igp8", "psir-igp9", "psir-igp10", "psir-igp11", "psir-igp12",
    ],
    ncertBook: "Indian Constitution at Work",
    ncertClass: 11,
    ncertSubject: "Political Science",
  },
  {
    subtopicIds: [
      "psir-igp1", "psir-igp2", "psir-igp9", "psir-igp10", "psir-igp11", "psir-igp12",
    ],
    ncertBook: "Politics in India Since Independence",
    ncertClass: 12,
    ncertSubject: "Political Science",
  },
  {
    subtopicIds: ["psir-cp1", "psir-cp2", "psir-cp3", "psir-cp4", "psir-ir1", "psir-ir2", "psir-ir3", "psir-ir4", "psir-ir5", "psir-ir6"],
    ncertBook: "Contemporary World Politics",
    ncertClass: 12,
    ncertSubject: "Political Science",
  },
  {
    subtopicIds: ["psir-iw1", "psir-iw2", "psir-iw3", "psir-iw4", "psir-iw5", "psir-iw6", "psir-iw7", "psir-iw8", "psir-iw9"],
    ncertBook: "Contemporary World Politics",
    ncertClass: 12,
    ncertSubject: "Political Science",
  },

  // --- Science (Class 6-10 combined Science, then separate Physics/
  // Chemistry/Biology from Class 11) -- grounds GS3's Science & Technology
  // section, previously the one GS3 sub-section with zero NCERT mapping
  // (see the header comment above). Weighted toward 6-10 per explicit
  // request: those are the foundational-literacy books (single combined
  // "Science" title per class, real NCERT structure -- it doesn't split
  // into Physics/Chemistry/Biology until class 11), listed first/primary;
  // 11-12's split subjects are the secondary, deeper layer for the
  // current-affairs-driven S&T topics (space, biotech, nano-tech) gs3-st3
  // specifically needs.
  { subtopicIds: ["gs3-st1", "gs3-st2", "gs3-st3"], ncertBook: "Science", ncertClass: 6, ncertSubject: "Science" },
  { subtopicIds: ["gs3-st1", "gs3-st2", "gs3-st3"], ncertBook: "Science", ncertClass: 7, ncertSubject: "Science" },
  { subtopicIds: ["gs3-st1", "gs3-st2", "gs3-st3"], ncertBook: "Science", ncertClass: 8, ncertSubject: "Science" },
  { subtopicIds: ["gs3-st1", "gs3-st2", "gs3-st3"], ncertBook: "Science", ncertClass: 9, ncertSubject: "Science" },
  { subtopicIds: ["gs3-st1", "gs3-st2", "gs3-st3"], ncertBook: "Science", ncertClass: 10, ncertSubject: "Science" },
  { subtopicIds: ["gs3-st2", "gs3-st3"], ncertBook: "Physics", ncertClass: 11, ncertSubject: "Physics" },
  { subtopicIds: ["gs3-st2", "gs3-st3"], ncertBook: "Physics", ncertClass: 12, ncertSubject: "Physics" },
  { subtopicIds: ["gs3-st2", "gs3-st3"], ncertBook: "Chemistry", ncertClass: 11, ncertSubject: "Chemistry" },
  { subtopicIds: ["gs3-st2", "gs3-st3"], ncertBook: "Chemistry", ncertClass: 12, ncertSubject: "Chemistry" },
  { subtopicIds: ["gs3-st2", "gs3-st3"], ncertBook: "Biology", ncertClass: 11, ncertSubject: "Biology" },
  { subtopicIds: ["gs3-st2", "gs3-st3"], ncertBook: "Biology", ncertClass: 12, ncertSubject: "Biology" },

  // --- Mathematics -- grounds CSAT's Basic Numeracy section, an exact
  // fit: the official CSAT syllabus text itself says "Class X level" (see
  // db/seed/csat-quant-syllabus.js's own header), so Class 6-10 Mathematics
  // maps onto it about as directly as an NCERT source ever will. Weighted
  // toward 6-10 per explicit request and per the syllabus's own wording;
  // 11-12 included as a secondary stretch layer, not the primary fit.
  {
    subtopicIds: ["csat-num1", "csat-num2", "csat-num3", "csat-num4", "csat-num5", "csat-num6", "csat-num7", "csat-num8", "csat-num9", "csat-num10", "csat-num11"],
    ncertBook: "Mathematics",
    ncertClass: 6,
    ncertSubject: "Mathematics",
  },
  {
    subtopicIds: ["csat-num1", "csat-num2", "csat-num3", "csat-num4", "csat-num5", "csat-num6", "csat-num7", "csat-num8", "csat-num9", "csat-num10", "csat-num11"],
    ncertBook: "Mathematics",
    ncertClass: 7,
    ncertSubject: "Mathematics",
  },
  {
    subtopicIds: ["csat-num1", "csat-num2", "csat-num3", "csat-num4", "csat-num5", "csat-num6", "csat-num7", "csat-num8", "csat-num9", "csat-num10", "csat-num11"],
    ncertBook: "Mathematics",
    ncertClass: 8,
    ncertSubject: "Mathematics",
  },
  {
    subtopicIds: ["csat-num1", "csat-num2", "csat-num3", "csat-num4", "csat-num5", "csat-num6", "csat-num7", "csat-num8", "csat-num9", "csat-num10", "csat-num11"],
    ncertBook: "Mathematics",
    ncertClass: 9,
    ncertSubject: "Mathematics",
  },
  {
    subtopicIds: ["csat-num1", "csat-num2", "csat-num3", "csat-num4", "csat-num5", "csat-num6", "csat-num7", "csat-num8", "csat-num9", "csat-num10", "csat-num11"],
    ncertBook: "Mathematics",
    ncertClass: 10,
    ncertSubject: "Mathematics",
  },
  { subtopicIds: ["csat-di1", "csat-di2", "csat-di3", "csat-di4"], ncertBook: "Mathematics", ncertClass: 8, ncertSubject: "Mathematics" },
  { subtopicIds: ["csat-di1", "csat-di2", "csat-di3", "csat-di4"], ncertBook: "Mathematics", ncertClass: 9, ncertSubject: "Mathematics" },
  { subtopicIds: ["csat-di1", "csat-di2", "csat-di3", "csat-di4"], ncertBook: "Mathematics", ncertClass: 10, ncertSubject: "Mathematics" },
];

export const ncertSourcesSeed = NCERT_ENTRIES.flatMap((entry) =>
  entry.subtopicIds.map((subtopicId) => ({
    subtopicId,
    title: `${entry.ncertBook} (NCERT, Class ${entry.ncertClass} ${entry.ncertSubject})`,
    // A URL fragment identifying the book, not a separate real page -- the
    // real destination is always NCERT's official textbook portal. This
    // exists so (subtopicId, url) stays unique per book even when a
    // subtopic is covered by more than one NCERT title (e.g. gs2's
    // Constitution subtopics span Democratic Politics I/II and Indian
    // Constitution at Work) -- app/api/setup's own re-run dedup logic
    // keys on exactly that pair, and three identical URLs for the same
    // subtopic would only ever let the first through, silently dropping
    // the other two book references on every rerun. Includes ncertClass,
    // not just the book title -- caught in review: "Science"/"Mathematics"
    // are reused as the exact same title across classes 6-10 (real NCERT
    // naming, one book per class, not one book overall), so title alone
    // collapsed Class 6-10 Science into one identical fragment and silently
    // dropped 4 of every 5 class-level entries on every setup rerun.
    url: `${NCERT_PORTAL_URL}#${slugify(entry.ncertBook)}-class-${entry.ncertClass}`,
    sourceType: "other",
    official: true,
    sourceTier: "ncert",
    ncertClass: entry.ncertClass,
    ncertBook: entry.ncertBook,
    ncertSubject: entry.ncertSubject,
  }))
);
