// db/schema.js
// Drizzle ORM schema (Postgres). Run `npx drizzle-kit push` to create these tables
// on your Supabase Postgres instance — see README for setup.

import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  serial,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * The 81-topic syllabus taxonomy (Paper I: Constitutional & Admin Law, International
 * Law. Paper II: Crimes, Torts, Contracts & Mercantile Law, Contemporary Legal
 * Developments). Reused from VidhiOS's already-verified topic codes so nothing
 * needs re-mapping.
 */
export const subtopics = pgTable("subtopics", {
  id: text("id").primaryKey(), // e.g. "CA1", "IL4", "CR10"
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
 */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  subtopicId: text("subtopic_id")
    .notNull()
    .references(() => subtopics.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(), // 'bare_act' | 'judgment' | 'treaty' | 'commission_report' | 'gazette' | 'press_release' | 'other'
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
 */
export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
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
 * One row per subtopic: the running mastery estimate the adaptive engine both
 * reads and updates. See lib/adaptive/engine.js for the update rule.
 */
export const mastery = pgTable("mastery", {
  subtopicId: text("subtopic_id")
    .primaryKey()
    .references(() => subtopics.id),
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
