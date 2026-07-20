// lib/ingest/structure.js
//
// Turns one ingestUploads row's raw extracted text into candidate
// ingestItems rows -- ONE AI call per document, never per-chunk/per-page
// (see the Phase 2 plan's cost-optimisation discussion). Defensive
// normalization below mirrors lib/ai/generateLesson.js's
// normalizeCoreResult/normalizePracticeResult style: filter out malformed
// entries and clamp string lengths rather than trusting the model's JSON
// blindly.

import { callClaudeForJSON } from "../ai/client.js";
import { getIngestDocTypeConfig } from "./config.js";

const MAX_ITEMS_PER_DOCUMENT = 60; // sane upper bound so a runaway response can't create hundreds of rows to review

function buildUserPrompt({ text, existingSubtopics }) {
  const subtopicsList = existingSubtopics.length
    ? existingSubtopics.map((s) => `${s.id}: ${s.topicText}`).join("\n")
    : "(no existing subtopics for this subject yet -- everything will be new)";

  return `Existing subtopics for this subject (match against these where possible, by id):
${subtopicsList}

Document text:
"""
${text}
"""

Extract the items now. Return only the JSON object.`;
}

function clampString(value, maxLen) {
  return typeof value === "string" ? value.slice(0, maxLen) : "";
}

function normalizeCommon(it) {
  const confidence = ["high", "medium", "low"].includes(it.confidence) ? it.confidence : "low";
  return { confidence, notes: clampString(it.notes, 500) };
}

function normalizeSubtopicItem(it) {
  if (typeof it.topicText !== "string" || !it.topicText.trim()) return null;
  return {
    existingSubtopicId: typeof it.existingSubtopicId === "string" ? it.existingSubtopicId : null,
    isNewSubtopic: Boolean(it.isNewSubtopic),
    suggestedId: clampString(it.suggestedId, 40),
    paper: Number.isFinite(it.paper) ? it.paper : null,
    section: clampString(it.section, 200),
    topicText: it.topicText.trim().slice(0, 500),
    ...normalizeCommon(it),
  };
}

function normalizePyqItem(it) {
  if (typeof it.questionText !== "string" || !it.questionText.trim()) return null;
  return {
    suggestedId: clampString(it.suggestedId, 40),
    year: Number.isFinite(it.year) ? it.year : null,
    paper: Number.isFinite(it.paper) ? it.paper : null,
    slot: Number.isFinite(it.slot) ? it.slot : null,
    sec: it.sec === "A" || it.sec === "B" ? it.sec : "A",
    sub: clampString(it.sub, 2) || "a",
    marks: Number.isFinite(it.marks) ? it.marks : null,
    questionText: it.questionText.trim().slice(0, 2000),
    matchedTopics: Array.isArray(it.matchedTopics) ? it.matchedTopics.filter((t) => typeof t === "string").slice(0, 5) : [],
    newTopicSuggestion: typeof it.newTopicSuggestion === "string" ? clampString(it.newTopicSuggestion, 200) : null,
    ...normalizeCommon(it),
  };
}

function normalizeSourceItem(it) {
  if (typeof it.excerptText !== "string" || !it.excerptText.trim()) return null;
  return {
    matchedSubtopicId: typeof it.matchedSubtopicId === "string" ? it.matchedSubtopicId : null,
    newSubtopicSuggestion: typeof it.newSubtopicSuggestion === "string" ? clampString(it.newSubtopicSuggestion, 200) : null,
    title: clampString(it.title, 200) || "Untitled",
    sourceType: clampString(it.sourceType, 50) || "other",
    excerptText: it.excerptText.trim().slice(0, 10000),
    ...normalizeCommon(it),
  };
}

const NORMALIZERS = {
  subtopic: normalizeSubtopicItem,
  pyq: normalizePyqItem,
  source: normalizeSourceItem,
};

function normalizeItems(rawItems, itemType) {
  if (!Array.isArray(rawItems)) return [];
  const normalize = NORMALIZERS[itemType];
  return rawItems
    .filter((it) => it && typeof it === "object")
    .slice(0, MAX_ITEMS_PER_DOCUMENT)
    .map(normalize)
    .filter(Boolean);
}

/**
 * `upload` is an ingestUploads row (needs docType, extractedText).
 * `existingSubtopics` is [{ id, topicText }] for the upload's subject, so
 * the model can propose a match instead of always inventing a new one.
 * Returns { items, textTruncatedForAi } -- items are plain objects shaped
 * per lib/ingest/config.js's docType contract, ready to insert as
 * ingestItems.suggestedData rows; callers set itemType/uploadId themselves.
 */
export async function structureUpload(upload, existingSubtopics) {
  const config = getIngestDocTypeConfig(upload.docType);
  const fullText = upload.extractedText || "";
  const textTruncatedForAi = fullText.length > config.textCap;
  const text = textTruncatedForAi ? fullText.slice(0, config.textCap) : fullText;

  const raw = await callClaudeForJSON({
    system: config.buildSystem(),
    user: buildUserPrompt({ text, existingSubtopics }),
    maxTokens: config.maxTokens,
  });

  const items = normalizeItems(raw?.items, config.itemType);
  return { items, itemType: config.itemType, textTruncatedForAi };
}
