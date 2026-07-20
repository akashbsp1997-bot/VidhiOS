// db/schema.js
// Drizzle ORM schema (Postgres). Run `npx drizzle-kit push` to create these tables
// on your Supabase Postgres instance — see README for setup.

import {
  pgTable,
  pgSchema,
  text,
  integer,
  real,
  boolean,
  uuid,
  timestamp,
  jsonb,
  serial,
  primaryKey,
} from "drizzle-orm/pg-core";

// Supabase Auth's own schema/table -- referenced, never created/migrated by us.
// drizzle-kit introspects and skips it since it already exists in Supabase.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

/**
 * One row per exam component this app can serve content for: each optional
 * subject (Law Optional today, more later), each GS Mains paper, Essay, and
 * (structurally representable, not yet built) Prelims GS/CSAT. `answerFormat`
 * is the seam a future MCQ-based Prelims engine hangs off without touching
 * the descriptive-format tables/routes that exist today.
 */
export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(), // slug, e.g. "law-optional", "gs1", "essay"
  displayName: text("display_name").notNull(), // e.g. "Law Optional", "GS Paper I"
  category: text("category").notNull(), // 'optional' | 'gs' | 'essay' | 'prelims'
  examStage: text("exam_stage").notNull(), // 'mains' | 'prelims'
  answerFormat: text("answer_format").notNull(), // 'descriptive' | 'essay' | 'mcq'
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * The 81-topic syllabus taxonomy (Paper I: Constitutional & Admin Law, International
 * Law. Paper II: Crimes, Torts, Contracts & Mercantile Law, Contemporary Legal
 * Developments). Reused from VidhiOS's already-verified topic codes so nothing
 * needs re-mapping.
 *
 * `id` is the sole PK across ALL subjects/subtopics, not just Law's -- existing
 * Law codes ("CA1", "IL4", ...) are never renamed. Every subtopic code for a
 * NEW subject added later must be prefixed with that subject's slug (e.g.
 * "gs1-ind1") to keep this column globally unique by convention, since nothing
 * enforces uniqueness beyond the PK itself.
 */
export const subtopics = pgTable("subtopics", {
  id: text("id").primaryKey(), // e.g. "CA1", "IL4", "CR10"
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  paper: integer("paper").notNull(), // 1 or 2
  section: text("section").notNull(), // e.g. "Constitutional and Administrative Law"
  topicText: text("topic_text").notNull(),
  pyqFrequency: integer("pyq_frequency").notNull().default(0), // denormalized count, refreshed by seed script
});

/**
 * Official/government source documents registered against a subtopic. `official`
 * distinguishes primary sources (India Code, UN, court/ministry sites) from
 * secondary reference material. Cache fields hold the last successful fetch so
 * the app can show/ground content without re-fetching on every view.
 *
 * `sourceTier` is the trust/licensing hierarchy content is grounded against, in
 * priority order: 'ncert' (root -- NCERT permits free educational reproduction)
 * > 'official' (govt works meant for redistribution, e.g. PIB/ministry releases)
 * > 'newspaper' (editorial content -- fetch policy caps this to excerpts, never
 * full paywalled-article text) > 'private_vendor' (commercially sold coaching
 * content -- fetch policy never extracts full text for this tier, link/title
 * only; see lib/sources/fetchAndCache.js). Nullable until backfilled; existing
 * rows predate this tiering and default to 'official' on backfill.
 */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  subtopicId: text("subtopic_id")
    .notNull()
    .references(() => subtopics.id),
  title: text("title").notNull(),
  // Normally a real http(s) URL. Rows created from an ingested upload (see
  // ingestUploads below) instead carry the sentinel "storage://ingest-uploads/<path>"
  // -- url stays NOT NULL either way so every other reader of this column
  // (app/sources/[subtopicId]/page.jsx, lib/sources/*) doesn't need a null
  // check; that page special-cases the storage:// prefix and resolves a
  // fresh signed URL via /api/sources/signed-url instead of rendering it
  // as a normal href.
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(), // 'bare_act' | 'judgment' | 'treaty' | 'commission_report' | 'gazette' | 'press_release' | 'other'
  sourceTier: text("source_tier"), // 'ncert' | 'official' | 'newspaper' | 'private_vendor'
  official: boolean("official").notNull().default(true),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  // Set only for rows created via the ingestion pipeline (app/api/ingest/*) --
  // null for every manually-seeded/URL-fetched row. Lets /api/sources/signed-url
  // find the backing Storage object without parsing the storage:// sentinel.
  storageUploadId: integer("storage_upload_id").references(() => ingestUploads.id),
  // --- cache, populated by lib/sources/fetchAndCache.js ---
  fetchedAt: timestamp("fetched_at"),
  extractedText: text("extracted_text"), // truncated plain-text extract, ~8-10k chars
  status: text("status").notNull().default("pending"), // 'pending' | 'ok' | 'error'
  errorMsg: text("error_msg"),
});

/**
 * One row per PDF uploaded through the ingestion pipeline (app/api/ingest/*),
 * created only after the bytes are already confirmed present in the private
 * 'ingest-uploads' Supabase Storage bucket -- so a row here always has a real
 * backing object, never a dangling reference. The PDF itself is the
 * permanent backup; this row tracks status through extraction and AI
 * structuring. See docs/ARCHITECTURE.md (Phase 2) for the full pipeline.
 */
export const ingestUploads = pgTable("ingest_uploads", {
  id: serial("id").primaryKey(),
  docType: text("doc_type").notNull(), // 'syllabus' | 'pyq_paper' | 'ncert_chapter' | 'newspaper_clipping'
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  storagePath: text("storage_path").notNull(), // object key within the 'ingest-uploads' bucket
  originalFilename: text("original_filename").notNull(),
  // Set only when this upload came from app/api/ingest/fetch-url (fetching
  // a public PDF URL server-side) rather than a browser file upload -- kept
  // for provenance, so the operator can click through and verify a
  // candidate against its real public source (e.g. ncert.nic.in) before
  // approving it, same spirit as sources.url for hand-registered sources.
  // Null for browser-uploaded files, which have no such public origin.
  sourceUrl: text("source_url"),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  contentHash: text("content_hash").notNull(), // sha256 of the raw PDF bytes -- exact-duplicate detection
  pageCount: integer("page_count"), // from pdf-parse; null until extraction runs
  extractedCharCount: integer("extracted_char_count"),
  extractedText: text("extracted_text"), // full extracted text, NOT capped like sources.extractedText
  textTruncatedForAi: boolean("text_truncated_for_ai").notNull().default(false), // true if lib/ingest/structure.js had to cut this before the AI call
  status: text("status").notNull().default("uploaded"), // uploaded -> extracted -> structured | needs_ocr | duplicate | error
  dupOfUploadId: integer("dup_of_upload_id"), // self-referencing; set when status = 'duplicate'
  errorMsg: text("error_msg"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  extractedAt: timestamp("extracted_at"),
  structuredAt: timestamp("structured_at"),
});

/**
 * One AI-suggested candidate record per row, awaiting operator review --
 * never written to subtopics/pyqs/sources until approved. itemType decides
 * which live table a commit targets (see lib/ingest/commit.js); it's set
 * from the upload's docType via a fixed mapping, never chosen by the AI.
 */
export const ingestItems = pgTable("ingest_items", {
  id: serial("id").primaryKey(),
  uploadId: integer("upload_id")
    .notNull()
    .references(() => ingestUploads.id),
  itemType: text("item_type").notNull(), // 'subtopic' | 'pyq' | 'source'
  suggestedSubtopicId: text("suggested_subtopic_id"), // AI's best-guess match against an EXISTING subtopics.id -- not a DB FK, since it may not exist yet
  suggestedSubtopicIsNew: boolean("suggested_subtopic_is_new").notNull().default(false),
  suggestedData: jsonb("suggested_data").notNull(), // raw AI output, shaped per itemType -- see lib/ingest/config.js
  finalData: jsonb("final_data"), // operator-edited version; falls back to suggestedData at commit time
  reviewStatus: text("review_status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  commitError: text("commit_error"), // set if an approve attempt's commit step failed -- reviewStatus stays 'pending' so it's retryable, never silently dropped
  committedTable: text("committed_table"), // 'subtopics' | 'pyqs' | 'sources', set only on a successful commit
  committedId: text("committed_id"), // the live row's PK, as text
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Real UPSC CSE Mains PYQs across subjects (Law Optional 2023-2025, GS Paper
 * II 2015-2025, more to follow). `topics` holds one or more subtopic codes.
 *
 * `marks` is `real`, not `integer` -- GS papers used a uniform 12.5-mark
 * format (250/20 questions) through 2016 before switching to the current
 * 10/15 split; storing that as a rounded integer would misrepresent a real
 * historical paper to anyone using this for exam prep.
 */
export const pyqs = pgTable("pyqs", {
  id: text("id").primaryKey(), // e.g. "Y25-P1-Q1a"
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  paper: integer("paper").notNull(),
  year: integer("year").notNull(),
  slot: integer("slot").notNull(), // matches the real question number on the paper
  sec: text("sec").notNull(), // "A" | "B"
  sub: text("sub").notNull(), // "a".."e"; a single, non-compound question uses "a"
  marks: real("marks").notNull(),
  topics: text("topics").array().notNull(),
  questionText: text("question_text").notNull(),
});

/**
 * AI-generated questions, written once and reused. Kept separate from pyqs so we
 * never confuse a model-authored question with a real past-paper question — the
 * distinction matters for anyone later auditing what was actually asked in an exam.
 */
export const modelQuestions = pgTable("model_questions", {
  id: serial("id").primaryKey(),
  subtopicId: text("subtopic_id")
    .notNull()
    .references(() => subtopics.id),
  difficultyTier: integer("difficulty_tier").notNull(), // 1 (PYQ-level) .. 3 (tougher/analytical/cross-topic)
  marks: integer("marks").notNull().default(15),
  questionText: text("question_text").notNull(),
  groundedSourceIds: integer("grounded_source_ids").array(), // sources.id[] used to ground generation, if any
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * One row per question actually answered — never batched. This is the record
 * the adaptive engine reads to decide what to serve next. Every row belongs
 * to exactly one user (see app/api/setup/phase1-reset/route.js for how the
 * pre-multi-user rows were cleared before this became NOT NULL).
 */
export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id),
  subtopicId: text("subtopic_id")
    .notNull()
    .references(() => subtopics.id),
  questionSource: text("question_source").notNull(), // 'pyq' | 'model'
  questionRefId: text("question_ref_id").notNull(), // pyqs.id or model_questions.id (as text)
  questionTextSnapshot: text("question_text_snapshot").notNull(), // self-contained even if the question later changes
  difficultyTier: integer("difficulty_tier").notNull(),
  marks: integer("marks").notNull(),
  answerText: text("answer_text").notNull(),
  score: integer("score"), // 0-100 from AI grading; null while grading is in flight
  feedback: jsonb("feedback"), // { strengths: [], weaknesses: [], missedProvisions: [], verdict: "" }
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * One row per (user, subtopic): the running mastery estimate the adaptive
 * engine both reads and updates. See lib/adaptive/engine.js for the update
 * rule.
 *
 * PK is composite (userId, subtopicId) -- each user has their own mastery
 * state per subtopic. Pre-multi-user rows were cleared (not backfilled to
 * an owner) via app/api/setup/phase1-reset/route.js before this landed.
 */
export const mastery = pgTable(
  "mastery",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    subtopicId: text("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    masteryScore: real("mastery_score").notNull().default(0),
    attemptsCount: integer("attempts_count").notNull().default(0),
    currentTier: integer("current_tier").notNull().default(1),
    recentScores: jsonb("recent_scores").notNull().default([]),
    lastAttemptAt: timestamp("last_attempt_at"),
    stage: text("stage").notNull().default("teach"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.subtopicId] }),
  })
);

export const lessons = pgTable("lessons", {
  subtopicId: text("subtopic_id")
    .primaryKey()
    .references(() => subtopics.id),
  teachContent: text("teach_content").notNull(),
  keyProvisions: jsonb("key_provisions").notNull().default([]),
  caseLaw: jsonb("case_law").notNull().default([]),
  perspectives: jsonb("perspectives").notNull().default([]),
  answerFramework: text("answer_framework"),
  examples: jsonb("examples").notNull(),
  exercises: jsonb("exercises").notNull(),
  mnemonics: jsonb("mnemonics").notNull(),
  visualOutline: jsonb("visual_outline").notNull(),
  visualImageDataUri: text("visual_image_data_uri"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});
