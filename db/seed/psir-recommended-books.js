// db/seed/psir-recommended-books.js
//
// A citation-only recommended-reading list for Political Science and
// International Relations Optional -- title/author/publisher shown
// prominently (never hidden), pointing at a Google Books search for each
// title rather than any full-text/download link. This is the compliant
// version of a "booklist" feature: it tells a student WHAT to read and
// WHO wrote it, the same way a syllabus or library catalog does, instead
// of hosting or redistributing the books' actual copyrighted content --
// see lib/sources/tiers.js's header for why 'private_vendor'-tier sources
// (which this is: commercially sold books, not free/official material)
// are title/link only in this app, never fetched or cached in full.
//
// Every title/author/publisher below was verified via live web search
// against current UPSC PSIR prep resources (2026-07-24), cross-checked
// across independent sources rather than taken from memory alone -- same
// discipline this app already holds itself to for PYQs/syllabus content.
// Deliberately NOT exhaustive: only titles that came back consistently
// verified are included; several other commonly-mentioned titles were
// left out for lack of a second independent confirmation, an honest gap
// rather than a guessed entry. No edition number is given (editions turn
// over yearly and aren't something a web search reliably confirms as
// "current") -- "latest edition" is a deliberate instruction to the
// student, not a filled-in guess.
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function googleBooksSearchUrl(title, author) {
  return `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(`${title} ${author}`)}`;
}

const BOOK_ENTRIES = [
  {
    title: "An Introduction to Political Theory",
    author: "O.P. Gauba",
    publisher: "Mayur Paperbacks",
    subtopicIds: ["psir-pt1", "psir-pt2", "psir-pt3", "psir-pt4", "psir-pt5", "psir-pt6", "psir-pt7", "psir-pt8"],
  },
  {
    title: "Political Theory: An Introduction",
    author: "Andrew Heywood",
    publisher: "Palgrave Macmillan",
    subtopicIds: ["psir-pt1", "psir-pt2", "psir-pt6", "psir-pt7", "psir-pt8", "psir-pt10"],
  },
  {
    title: "Politics in India",
    author: "Rajni Kothari",
    publisher: "Orient Blackswan",
    subtopicIds: ["psir-igp1", "psir-igp10", "psir-igp11"],
  },
  {
    title: "Introduction to the Constitution of India",
    author: "D.D. Basu",
    publisher: "LexisNexis",
    subtopicIds: ["psir-igp2", "psir-igp3", "psir-igp4", "psir-igp5", "psir-igp7", "psir-igp8"],
  },
  {
    title: "Indian Government and Politics",
    author: "B.L. Fadia",
    publisher: "Sahitya Bhawan Publications",
    subtopicIds: ["psir-igp4", "psir-igp5", "psir-igp6", "psir-igp7", "psir-igp8", "psir-igp9", "psir-igp11", "psir-igp12"],
  },
  {
    title: "Our Constitution",
    author: "Subhash C. Kashyap",
    publisher: "National Book Trust",
    subtopicIds: ["psir-igp2", "psir-igp3"],
  },
  {
    title: "India Since Independence",
    author: "Bipan Chandra, Mridula Mukherjee, Aditya Mukherjee",
    publisher: "Penguin",
    subtopicIds: ["psir-igp1", "psir-igp9", "psir-igp10"],
  },
  {
    title: "Comparative Government and Politics: An Introduction",
    author: "Rod Hague, Martin Harrop",
    publisher: "Palgrave Macmillan",
    subtopicIds: ["psir-cp1", "psir-cp2", "psir-cp3", "psir-cp4"],
  },
  {
    title: "Comparative Politics",
    author: "J.C. Johari",
    publisher: "Sterling Publishers",
    subtopicIds: ["psir-cp1", "psir-cp2", "psir-cp3"],
  },
  {
    title: "International Relations",
    author: "V.N. Khanna",
    publisher: "Vikas Publishing House",
    subtopicIds: ["psir-ir1", "psir-ir2", "psir-ir3", "psir-ir4", "psir-ir5", "psir-ir6"],
  },
  {
    title: "World Politics",
    author: "Andrew Heywood",
    publisher: "Palgrave Macmillan",
    subtopicIds: ["psir-ir1", "psir-ir2", "psir-ir3", "psir-ir4", "psir-ir5", "psir-ir6", "psir-cp4"],
  },
  {
    title: "International Relations",
    author: "Joshua Goldstein, Jon Pevehouse",
    publisher: "Pearson",
    subtopicIds: ["psir-ir1", "psir-ir2", "psir-ir3", "psir-ir6"],
  },
  {
    title: "India's Foreign Policy",
    author: "V.P. Dutt",
    publisher: "Vikas Publishing House",
    subtopicIds: ["psir-iw1", "psir-iw2", "psir-iw3", "psir-iw9"],
  },
];

export const psirRecommendedBooksSeed = BOOK_ENTRIES.flatMap((entry) =>
  entry.subtopicIds.map((subtopicId) => ({
    subtopicId,
    title: `${entry.title} — ${entry.author} (${entry.publisher}, latest edition)`,
    // Google Books search, not a download/full-text link -- helps a student
    // locate/verify/buy or borrow the real book, never serves its content.
    url: googleBooksSearchUrl(entry.title, entry.author),
    sourceType: "other",
    official: false, // a commercially sold book, not government/NCERT material
    sourceTier: "private_vendor", // title/link only, never fetched -- see lib/sources/tiers.js
  }))
);
