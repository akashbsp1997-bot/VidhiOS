// lib/ingest/commit.js
//
// Commits one ingestItem's (approved) data to its live table -- the exact
// upsert idioms already used in app/api/setup/route.js, reused here rather
// than reinvented. Throws IngestCommitError on a validation problem (a
// missing field, a subtopic that doesn't exist yet); the caller
// (app/api/ingest/review/action) catches this and leaves reviewStatus
// "pending" with commitError set, so a bad commit is retryable rather than
// silently dropped.

import { eq, sql } from "drizzle-orm";
import { subtopics, pyqs, sources } from "../../db/schema.js";
import { getIngestDocTypeConfig } from "./config.js";
import { toStorageSentinel } from "./storageUrl.js";

class IngestCommitError extends Error {}

function requireFields(data, fields) {
  const missing = fields.filter((f) => data[f] === null || data[f] === undefined || data[f] === "");
  if (missing.length) {
    throw new IngestCommitError(`Missing required field(s) before this can be approved: ${missing.join(", ")}. Edit them and try again.`);
  }
}

async function commitSubtopic(db, item, upload) {
  const id = item.existingSubtopicId && !item.isNewSubtopic ? item.existingSubtopicId : item.suggestedId;
  requireFields({ id, paper: item.paper, section: item.section, topicText: item.topicText }, ["id", "paper", "section", "topicText"]);

  await db
    .insert(subtopics)
    .values({ id, subjectId: upload.subjectId, paper: item.paper, section: item.section, topicText: item.topicText })
    .onConflictDoUpdate({
      target: subtopics.id,
      set: { section: sql`excluded.section`, topicText: sql`excluded.topic_text`, paper: sql`excluded.paper` },
    });

  return { committedTable: "subtopics", committedId: id };
}

async function commitPyq(db, item, upload) {
  const topics = item.matchedTopics?.length ? item.matchedTopics : item.newTopicSuggestion ? [item.newTopicSuggestion] : null;
  requireFields(
    {
      id: item.suggestedId,
      year: item.year,
      paper: item.paper,
      slot: item.slot,
      sec: item.sec,
      sub: item.sub,
      marks: item.marks,
      questionText: item.questionText,
      topics,
    },
    ["id", "year", "paper", "slot", "sec", "sub", "marks", "questionText", "topics"]
  );

  await db
    .insert(pyqs)
    .values({
      id: item.suggestedId,
      subjectId: upload.subjectId,
      paper: item.paper,
      year: item.year,
      slot: item.slot,
      sec: item.sec,
      sub: item.sub,
      marks: item.marks,
      topics,
      questionText: item.questionText,
    })
    .onConflictDoNothing({ target: pyqs.id });

  return { committedTable: "pyqs", committedId: item.suggestedId };
}

async function commitSource(db, item, upload) {
  requireFields({ subtopicId: item.matchedSubtopicId, excerptText: item.excerptText }, ["subtopicId", "excerptText"]);

  const [subtopicRow] = await db.select({ id: subtopics.id }).from(subtopics).where(eq(subtopics.id, item.matchedSubtopicId));
  if (!subtopicRow) {
    throw new IngestCommitError(
      `matchedSubtopicId "${item.matchedSubtopicId}" doesn't exist yet -- approve/create that subtopic first (e.g. via a syllabus upload), or edit this item to a real existing subtopic id.`
    );
  }

  const config = getIngestDocTypeConfig(upload.docType);
  const existing = await db.select({ id: sources.id, title: sources.title }).from(sources).where(eq(sources.subtopicId, item.matchedSubtopicId));
  const titleMatch = existing.find((s) => s.title.trim().toLowerCase() === (item.title || "").trim().toLowerCase());

  const [row] = await db
    .insert(sources)
    .values({
      subtopicId: item.matchedSubtopicId,
      title: item.title || "Untitled",
      url: toStorageSentinel(upload.storagePath),
      sourceType: item.sourceType || "other",
      sourceTier: config.sourceTier,
      official: upload.docType === "ncert_chapter",
      storageUploadId: upload.id,
      extractedText: item.excerptText,
      fetchedAt: new Date(),
      status: "ok",
    })
    .returning({ id: sources.id });

  return {
    committedTable: "sources",
    committedId: String(row.id),
    warning: titleMatch
      ? `A source titled "${titleMatch.title}" already exists for this subtopic (id ${titleMatch.id}) -- check this isn't a near-duplicate.`
      : undefined,
  };
}

const COMMITTERS = { subtopic: commitSubtopic, pyq: commitPyq, source: commitSource };

/**
 * `item` is an ingestItems row; `upload` is its parent ingestUploads row.
 * Commits finalData (falling back to suggestedData if never edited).
 */
export async function commitIngestItem(db, item, upload) {
  const committer = COMMITTERS[item.itemType];
  if (!committer) throw new IngestCommitError(`Unknown itemType "${item.itemType}"`);
  const data = item.finalData ?? item.suggestedData;
  return committer(db, data, upload);
}

export { IngestCommitError };
