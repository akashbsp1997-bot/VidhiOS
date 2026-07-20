// lib/ingest/config.js
//
// Per-docType "structuring contract" for lib/ingest/structure.js -- modeled
// directly on lib/subjects/config.js's SUBJECT_CONFIGS/getSubjectConfig
// pattern (a config object + a lookup function). Adding a 5th doc type
// means adding an entry here (and to lib/ingest/docTypes.js's
// INGEST_DOC_TYPES list) -- not touching structure.js's logic.

import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

function buildSyllabusSystem() {
  return `You read official UPSC syllabus documents and break them into individual syllabus subtopics, at the same granularity as a real syllabus taxonomy (e.g. "Union and State legislatures: structure, functioning, conduct of business" is ONE subtopic, not the whole "Indian Polity" section in one item).
${ANTI_HALLUCINATION_NOTE} Only propose subtopics that are actually named or clearly described in the text given to you -- do not invent additional exam topics from general knowledge of the subject.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "items": [
    {
      "existingSubtopicId": "<the id of an EXISTING subtopic from the list below that this most closely matches, or null if none fit>",
      "isNewSubtopic": <true if this is not already covered by an existing subtopic, false otherwise>,
      "suggestedId": "<a short lowercase-hyphenated id if new, e.g. 'gs2-c5'; empty string if matching an existing one>",
      "paper": <1 or 2, whichever paper this belongs to>,
      "section": "<the broader syllabus section/heading this falls under, as named in the document>",
      "topicText": "<the subtopic text itself, close to verbatim from the syllabus document>",
      "confidence": "high" | "medium" | "low",
      "notes": "<anything uncertain about this item, or empty string>"
    }
  ]
}`;
}

function buildPyqSystem() {
  return `You read real UPSC previous-year-question (PYQ) papers and extract each individual question as a separate item. The exam year is usually stated on the paper's cover/header text -- use that; if you truly cannot determine it from the text given, leave "year" null and say why in "notes" rather than guessing.
${ANTI_HALLUCINATION_NOTE} Every questionText must be the actual question as written in the source text -- never paraphrase, shorten, or reconstruct a question from memory of what a real exam might ask.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "items": [
    {
      "suggestedId": "<e.g. 'Y25-GS2-Q14', following the pattern <year>-<subject>-Q<number>>",
      "year": <4-digit exam year, or null if not determinable>,
      "paper": <1 or 2, or null if not stated>,
      "slot": <the question's number on the paper>,
      "sec": "A" | "B",
      "sub": "<'a' for a standalone question; 'a'..'e' for sub-parts of a compound question>",
      "marks": <the marks allotted to this question, as a number -- can be a decimal like 12.5>,
      "questionText": "<the question exactly as written>",
      "matchedTopics": ["<id(s) of existing subtopics this question tests, from the list below>"],
      "newTopicSuggestion": "<a short description if this question doesn't fit any existing subtopic, else null>",
      "confidence": "high" | "medium" | "low",
      "notes": "<anything uncertain about this item, or empty string>"
    }
  ]
}`;
}

function buildSourceSystem(label, sourceType) {
  return `You read a ${label} and identify the distinct topics/themes it covers, producing one grounding-excerpt item per theme, each tagged to whichever existing subtopic it's most relevant to. A single long document should usually become SEVERAL items, one per major theme -- not one giant item for the whole document.
${ANTI_HALLUCINATION_NOTE} excerptText must be drawn from the actual text given to you (a faithful excerpt or tight summary of it), never invented or recalled from general knowledge.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "items": [
    {
      "matchedSubtopicId": "<the id of an EXISTING subtopic from the list below this excerpt is most relevant to, or null if none fit>",
      "newSubtopicSuggestion": "<a short description if this covers a topic no existing subtopic captures, else null>",
      "title": "<a short descriptive title for this excerpt>",
      "sourceType": "${sourceType}",
      "excerptText": "<the excerpt itself, drawn from the source text -- a few hundred to a couple thousand words>",
      "confidence": "high" | "medium" | "low",
      "notes": "<anything uncertain about this item, or empty string>"
    }
  ]
}`;
}

export const INGEST_DOC_TYPE_CONFIGS = {
  // maxTokens raised from 3500 after a live failure: finish_reason:"length"
  // on a tiny (1-page) syllabus PDF, meaning it wasn't input size driving
  // the overrun -- nvidia/nemotron-3-nano-30b-a3b:free appears to spend a
  // meaningful chunk of its budget before emitting the final JSON (visible
  // reasoning/thinking content is common for this model family). The 45s
  // AI_TIMEOUT_MS in lib/ai/client.js still bounds worst-case wall time
  // regardless of this ceiling, so raising it has no real downside -- it
  // either finishes now, or still times out cleanly like before.
  syllabus: { itemType: "subtopic", maxTokens: 8000, textCap: 15000, buildSystem: buildSyllabusSystem },
  pyq_paper: { itemType: "pyq", maxTokens: 8000, textCap: 15000, buildSystem: buildPyqSystem },
  // textCap raised 12000 -> 40000 after a live case: a 244-page NCERT book
  // (~350K extracted chars) was only getting its first ~8 pages sent to the
  // AI per structuring call. 40000 covers roughly the first 28 pages instead
  // -- meaningfully more, not a fix for "the whole book in one call" (there's
  // still no multi-chunk map-reduce here; a genuinely huge document still
  // needs either multiple uploads/URLs per section, or that feature being
  // built later). maxTokens raised alongside it (6000 -> 8000, matching
  // syllabus/pyq_paper) since more input text plausibly means more distinct
  // themes/excerpt candidates for the model to emit, not just a bigger
  // prompt. textTruncatedForAi (see structure.js) still surfaces in the
  // review UI whenever a document exceeds this cap, so the gap stays
  // visible rather than silent.
  ncert_chapter: {
    itemType: "source",
    sourceTier: "ncert",
    maxTokens: 8000,
    textCap: 40000,
    buildSystem: () => buildSourceSystem("NCERT textbook chapter", "ncert_chapter"),
  },
  newspaper_clipping: {
    itemType: "source",
    sourceTier: "newspaper",
    maxTokens: 8000,
    textCap: 40000,
    buildSystem: () => buildSourceSystem("newspaper / current-affairs clipping", "newspaper_clipping"),
  },
};

export function getIngestDocTypeConfig(docType) {
  const config = INGEST_DOC_TYPE_CONFIGS[docType];
  if (!config) {
    throw new Error(`No INGEST_DOC_TYPE_CONFIGS entry for docType "${docType}" -- add one to lib/ingest/config.js.`);
  }
  return config;
}
