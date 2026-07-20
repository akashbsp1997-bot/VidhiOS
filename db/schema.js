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
  subjectId: text("subject_id").references(() => subjects.id), // nullable until backfilled
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
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(), // 'bare_act' | 'judgment' | 'treaty' | 'commission_report' | 'gazette' | 'press_release' | 'other'
  sourceTier: text("source_tier"), // 'ncert' | 'official' | 'newspaper' | 'private_vendor'
  official: boolean("official").notNull().default(true),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  // --- cache, populated by lib/sources/fetchAndCache.js ---
  fetchedAt: timestamp("fetched_at"),
  extractedText: text("extracted_text"), // truncated plain-text extract, ~8-10k chars
  status: text("status").notNull().default("pending"), // 'pending' | 'ok' | 'error'
  errorMsg: text("error_msg"),
});

/**
 * The 168 real UPSC CSE Law optional PYQs (2023-2025, Paper I & II), carried over
 * verbatim from VidhiOS. `topics` holds one or more subtopic codes.
 */
export const pyqs = pgTable("pyqs", {
  id: text("id").primaryKey(), // e.g. "Y25-P1-Q1a"
  subjectId: text("subject_id").references(() => subjects.id), // nullable until backfilled
  paper: integer("paper").notNull(),
  year: integer("year").notNull(),
  slot: integer("slot").notNull(), // 1-8, matches the real question number on the paper
  sec: text("sec").notNull(), // "A" | "B"
  sub: text("sub").notNull(), // "a".."e"
  marks: integer("marks").notNull(),
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
 * the adaptive engine reads to decide what to serve next.
 *
 * `userId` is nullable in this migration step only -- pre-multi-user rows are
 * being discarded (not backfilled to an owner), so it becomes NOT NULL once
 * that reset runs. See scripts/migrate-phase1.js.
 */
export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => authUsers.id),
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
 * PK is `subtopicId` alone in this migration step only, matching the
 * single-tenant data model that predates multi-user -- it becomes a composite
 * (userId, subtopicId) PK once pre-multi-user rows are reset (PR3, coupled
 * with the auth-aware routes landing in the same deploy). `userId` is
 * nullable until then.
 */
export const mastery = pgTable("mastery", {
  subtopicId: text("subtopic_id")
    .primaryKey()
    .references(() => subtopics.id),
  userId: uuid("user_id").references(() => authUsers.id),
  masteryScore: real("mastery_score").notNull().default(0),
  attemptsCount: integer("attempts_count").notNull().default(0),
  currentTier: integer("current_tier").notNull().default(1),
  recentScores: jsonb("recent_scores").notNull().default([]),
  lastAttemptAt: timestamp("last_attempt_at"),
  stage: text("stage").notNull().default("teach"),
});

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
