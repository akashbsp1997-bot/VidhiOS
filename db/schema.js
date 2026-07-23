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
  unique,
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
  // Only meaningful when sourceTier = 'ncert' -- which school class range a
  // concept is taught at is itself a real basics-to-advanced signal (see
  // lib/adaptive/unlocks.js's sourceScore), distinct from the coarser
  // ncert-vs-not distinction sourceTier alone gives. 'foundational' = class
  // 6-8, 'middle' = class 9-10, 'senior' = class 11-12. Null for every
  // non-NCERT source, and for an NCERT source not yet tagged (falls back to
  // 'senior' in scoring -- see drizzle/0011's backfill for why that's the
  // right default for every NCERT source in this app as of 2026-07-22).
  ncertLevel: text("ncert_level"),
  // Precise NCERT bibliographic metadata -- AI-suggested during ingest
  // review (see lib/ingest/config.js's buildNcertSourceSystem), always
  // operator-verified before commit like every other suggested field, never
  // written directly from an AI call. ncertClass (6-12) is the finer-grained
  // signal lib/adaptive/unlocks.js's sourceScore prefers over the coarser
  // ncertLevel bucket when both are present -- commit.js derives ncertLevel
  // from ncertClass automatically on approve, so older code paths reading
  // only ncertLevel keep working. All null for a non-NCERT source, or an
  // NCERT source whose class genuinely isn't stated anywhere in the document
  // (the AI is instructed to leave these null rather than guess).
  ncertClass: integer("ncert_class"),
  ncertBook: text("ncert_book"),
  ncertChapter: text("ncert_chapter"),
  ncertSubject: text("ncert_subject"),
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
  textTruncatedForAi: boolean("text_truncated_for_ai").notNull().default(false), // legacy -- see chunksProcessed/totalChunks, which superseded this once /api/ingest/structure started chunking instead of hard-truncating
  // A document longer than its docType's textCap (lib/ingest/config.js) gets
  // processed one chunk at a time -- one /api/ingest/structure call per
  // chunk, not one call for the whole (possibly huge) document, since a
  // single AI call has real per-request size/duration/rate-limit costs on
  // the free tier. totalChunks is computed and stored on the first
  // structure call; chunksProcessed only increments on a SUCCESSFUL chunk,
  // so a failed attempt retries the same chunk rather than skipping it or
  // losing earlier chunks' already-inserted ingestItems.
  totalChunks: integer("total_chunks"),
  chunksProcessed: integer("chunks_processed").notNull().default(0),
  status: text("status").notNull().default("uploaded"), // uploaded -> extracted -> structured | needs_ocr | duplicate | error ("extracted" also covers "more chunks left to structure")
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
  // Nullable: set only for a question generated with a moduleScope hint (see
  // lib/ai/generateQuestion.js) -- lets app/api/attempt's module-Test flow
  // find/reuse its one cached question via WHERE moduleId = X, without
  // disturbing the subtopic-wide pool this column defaults to (null) for.
  moduleId: integer("module_id").references(() => lessonModules.id),
  // Prelims MCQ practice mode (app/api/mcq/route.js) reuses this same table
  // rather than a parallel one -- it's still "one cached AI-generated
  // question per subtopic," just a different shape and a deterministic
  // grading path instead of an AI grading call. format/difficultyTier/marks
  // above stay meaningful for 'descriptive' rows exactly as before;
  // options/correctIndex/explanation are null for those and only set for
  // format:'mcq'.
  format: text("format").notNull().default("descriptive"), // 'descriptive' | 'mcq'
  options: jsonb("options"), // ["...", "...", "...", "..."], set only for format:'mcq'
  correctIndex: integer("correct_index"), // 0-3, set only for format:'mcq'
  explanation: text("explanation"), // set only for format:'mcq'
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
  questionSource: text("question_source").notNull(), // 'pyq' | 'model' | 'mcq' (see app/api/mcq/route.js)
  questionRefId: text("question_ref_id").notNull(), // pyqs.id or model_questions.id (as text)
  questionTextSnapshot: text("question_text_snapshot").notNull(), // self-contained even if the question later changes
  difficultyTier: integer("difficulty_tier").notNull(),
  marks: integer("marks").notNull(),
  answerText: text("answer_text").notNull(),
  score: integer("score"), // 0-100 from AI grading; null while grading is in flight
  feedback: jsonb("feedback"), // { strengths: [], weaknesses: [], missedProvisions: [], verdict: "" }
  // Nullable: set only when this attempt came from a module-scoped Test
  // (ModuleTestPanel), for traceability/UI labeling only -- no adaptive-engine
  // logic branches on it, mastery/tier updates read/write the same
  // (userId, subtopicId) mastery row regardless of whether this is set.
  moduleId: integer("module_id").references(() => lessonModules.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * One row per timed, multi-question mock test (see app/api/mock-tests/*) --
 * a bundle of several questions completed together as one sitting and
 * graded as a whole, unlike `attempts` above (always exactly one question).
 * Answers aren't persisted until grading time (see mockTestQuestions below)
 * -- the client holds them locally while the student works through the
 * paper, so an abandoned test just never gets its questions graded rather
 * than needing separate draft-save plumbing.
 */
export const mockTests = pgTable("mock_tests", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  size: text("size").notNull(), // 'sectional' | 'full'
  totalMarks: integer("total_marks").notNull(), // sum of the selected questions' marks
  durationMinutes: integer("duration_minutes").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  submittedAt: timestamp("submitted_at"), // null while still in progress
  totalScore: integer("total_score"), // sum of round(score/100 * marks) per question; null until finished
});

/**
 * One row per question within a mock test, in paper order. Mirrors
 * `attempts`' per-question shape (questionSource/questionRefId/marks/
 * answerText/score/feedback) but scoped to one mockTestId instead of being
 * a standalone practice attempt -- deliberately NOT also written into
 * `attempts` or read by the adaptive engine, same "separate signal"
 * principle as MCQ practice (see app/api/mcq/route.js): a mock test is a
 * self-check simulation, not a mastery-gating input.
 */
export const mockTestQuestions = pgTable("mock_test_questions", {
  id: serial("id").primaryKey(),
  mockTestId: integer("mock_test_id")
    .notNull()
    .references(() => mockTests.id),
  orderIndex: integer("order_index").notNull(),
  subtopicId: text("subtopic_id")
    .notNull()
    .references(() => subtopics.id),
  questionSource: text("question_source").notNull(), // 'pyq' | 'model'
  questionRefId: text("question_ref_id").notNull(),
  questionText: text("question_text").notNull(),
  marks: integer("marks").notNull(),
  answerText: text("answer_text"), // null until the student's grade-question call saves it
  score: integer("score"), // 0-100; null until graded (finish treats a still-null score as 0 marks earned)
  feedback: jsonb("feedback"),
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
    stage: text("stage").notNull().default("teach"), // which of teach/grasp/remember/test within the CURRENT module (or, for a legacy subtopic, within the whole subtopic)
    // Nullable: which lesson_modules.orderIndex the student is currently on
    // for this subtopic, so re-entering resumes where they left off. Null
    // for a subtopic still on the legacy (pre-module) lessons flow.
    currentModuleIndex: integer("current_module_index"),
    // Per-module mastery-gating state, keyed by lessonModules.id (jsonb
    // object keys are always strings): { [moduleId]: { highestStage:
    // "teach"|"grasp"|"remember"|"test", testAttempts: number, bestScore01:
    // number } }. highestStage is a sequential-completion high-water mark --
    // distinct from `stage` above (just "where the student is currently
    // looking," which moves backward freely via tab clicks). testAttempts
    // is what the next module's unlock check (lib/adaptive/unlocks.js)
    // requires be >=1, closing the loophole where unrelated prior attempts
    // elsewhere in the subtopic could already satisfy a pure mastery-score
    // check before this specific module was ever attempted.
    moduleProgress: jsonb("module_progress").notNull().default({}),
    // Personal, self-declared tracking -- deliberately separate from the
    // AI-graded masteryScore/stage/moduleProgress above, never read by the
    // adaptive engine or the mastery-gating logic (lib/adaptive/unlocks.js)
    // and never auto-updated by anything in this app. A student who read a
    // topic from their own outside sources, or just wants a personal
    // checklist independent of AI-graded practice, can mark it here without
    // that affecting what unlocks next -- keeps "I consider this covered"
    // and "the AI has verified I've mastered this" as two honestly distinct
    // signals instead of conflating them.
    notes: text("notes").notNull().default(""),
    selfStatus: text("self_status").notNull().default("not-started"), // 'not-started' | 'in-progress' | 'done'
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.subtopicId] }),
  })
);

/**
 * A THIRD, higher-level gate above subtopic/module gating (lib/adaptive/
 * unlocks.js): which whole GS papers and which single optional subject a
 * student can even see subtopics for at all. Row presence = unlocked, for a
 * (userId, subjectId) pair -- only ever written to for a "gated" subject
 * (category 'gs' or 'optional', see lib/adaptive/subjectUnlocks.js), never
 * for prelims/essay/qualifying, which stay accessible per the existing
 * subtopic-level gating alone. A student picks 2 GS subjects + 1 optional at
 * onboarding (3 rows inserted at once); more GS subjects unlock over time --
 * see maybeUnlockNextGsSubject in lib/adaptive/subjectUnlockState.js. The
 * optional choice is NOT grown the same way: a real UPSC candidate only ever
 * sits one optional paper, so exactly one optional row ever exists per user
 * (changeable later, but that's a deliberate settings action, not part of
 * the automatic unlock progression).
 */
export const subjectUnlocks = pgTable(
  "subject_unlocks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id),
    unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.subjectId] }),
  })
);

/**
 * Populated in three lazy phases, not all at once -- see lib/ai/generateLesson.js
 * and app/api/lesson/route.js. "core" (teachContent/keyProvisions/caseLaw) is
 * generated on first Teach visit and always present once a row exists.
 * "practice" (perspectives/answerFramework/examples/exercises/mnemonics/
 * visualOutline) only runs once the student reaches Grasp -- practiceGeneratedAt
 * is how the route knows whether that's happened yet (not an array-length
 * check: normalizePracticeResult can legitimately return an empty array,
 * which would look identical to "never generated" under a length check).
 * "image" (visualImageDataUri) only runs once the student reaches Remember.
 * The four columns below default so a core-only insert doesn't violate
 * NOT NULL before the later phases have run.
 */
export const lessons = pgTable("lessons", {
  subtopicId: text("subtopic_id")
    .primaryKey()
    .references(() => subtopics.id),
  teachContent: text("teach_content").notNull(),
  keyProvisions: jsonb("key_provisions").notNull().default([]),
  caseLaw: jsonb("case_law").notNull().default([]),
  perspectives: jsonb("perspectives").notNull().default([]),
  answerFramework: text("answer_framework"),
  examples: jsonb("examples").notNull().default([]),
  exercises: jsonb("exercises").notNull().default([]),
  mnemonics: jsonb("mnemonics").notNull().default([]),
  visualOutline: jsonb("visual_outline").notNull().default({ label: "Overview", children: [] }),
  practiceGeneratedAt: timestamp("practice_generated_at"),
  visualImageDataUri: text("visual_image_data_uri"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

/**
 * A subtopic decomposed into independently teachable/practiceable/testable
 * sub-concepts (see lib/ai/generateModules.js's generateModulePlan) -- each
 * row gets its OWN full Teach -> Grasp -> Remember -> Test cycle via
 * app/api/module-lesson/route.js, rather than one cycle covering the whole
 * subtopic (that's what `lessons` above still does, kept alive as the
 * legacy flow for subtopics that already have a complete row there).
 *
 * Rows are bulk-inserted as skeletons (title/scopeNote only) the moment a
 * subtopic's module plan is generated, THEN filled in lazily -- unlike
 * `lessons` (only ever inserted once its core phase is ready), so
 * `generatedAt`/`practiceGeneratedAt` are both nullable here with no
 * default, not "row exists" proxies.
 *
 * Deliberately lighter than `lessons`: no keyProvisions/caseLaw split (flat
 * keyPoints bullets instead), no perspectives/answerFramework (exam-answer
 * structuring belongs at the whole-subtopic/PYQ level, not a module slice),
 * no image/visualOutline phase at all, one mnemonic instead of an array --
 * this keeps the AI-call multiplier from a subtopic's module count sane
 * (see the plan doc / PR description for the concrete math).
 */
export const lessonModules = pgTable(
  "lesson_modules",
  {
    id: serial("id").primaryKey(),
    subtopicId: text("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    orderIndex: integer("order_index").notNull(), // 0-based sequence within the subtopic
    title: text("title").notNull(),
    scopeNote: text("scope_note").notNull().default(""), // planning output, fed back into every module-scoped prompt as narrowing context
    // Null = AI-invented fallback module (the subtopic had fewer than 2 real
    // PYQs to anchor to). Set = this module is built around answering this
    // exact real exam question -- its Teach/Grasp content is grounded in the
    // question's real text, and its Test serves this PYQ directly (zero AI
    // calls) instead of generating one. See app/api/module-lesson/route.js's
    // plan phase for the selection/threshold logic and
    // lib/ai/generateModules.js's generateModulePlanFromPyqs.
    pyqId: text("pyq_id").references(() => pyqs.id),
    // Teach phase, null until first Teach visit to this module
    teachContent: text("teach_content"),
    keyPoints: jsonb("key_points").notNull().default([]), // flat bullet strings, not structured keyProvisions/caseLaw objects
    generatedAt: timestamp("generated_at"),
    // Practice phase -- covers Grasp (examples/exercises/mnemonic), null
    // until first Grasp visit to this module
    examples: jsonb("examples").notNull().default([]),
    exercises: jsonb("exercises").notNull().default([]),
    mnemonic: jsonb("mnemonic"), // single {device, explanation} object, or null
    practiceGeneratedAt: timestamp("practice_generated_at"),
    // Image phase -- separate from practice again (reintroduced after
    // initially being cut for cost): null until first Remember visit,
    // non-fatal on generation failure (see generateModuleImage). Built from
    // this module's title/keyPoints, not a nested visualOutline tree like
    // lessons.visualImageDataUri -- a module is already a narrow single
    // concept, so a flat prompt is enough.
    visualImageDataUri: text("visual_image_data_uri"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    subtopicOrderUnique: unique("lesson_modules_subtopic_order_unique").on(table.subtopicId, table.orderIndex),
  })
);
