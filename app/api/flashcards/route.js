// app/api/flashcards/route.js
//
// GET  -> up to 20 due flashcards (never-reviewed cards count as due, same
//      as any spaced-repetition system) across this user's unlocked
//      subjects, derived fresh from already-generated Teach/Grasp content
//      (see lib/adaptive/flashcards.js) -- nothing here calls the AI.
// POST { cardId, subtopicId, quality: 'again'|'good'|'easy' } -> records a
//      review via simplified SM-2 (lib/adaptive/srs.js), updating when the
//      card is next due.
import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, lessons, lessonModules, flashcardReviews } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { loadUnlockedSubjectIds } from "../../../lib/adaptive/subjectUnlockState.js";
import { cardsFromLesson, cardsFromModule } from "../../../lib/adaptive/flashcards.js";
import { reviewCard, QUALITY, DEFAULT_EASE_FACTOR } from "../../../lib/adaptive/srs.js";

const MAX_DUE_PER_SESSION = 20;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function derivePool(userId) {
  const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
  const unlockedSubjectIds = optionalSubjectId ? [...unlockedGsIds, optionalSubjectId] : unlockedGsIds;
  if (!unlockedSubjectIds.length) return null;

  const subtopicRows = await db.select().from(subtopics).where(inArray(subtopics.subjectId, unlockedSubjectIds));
  const ids = subtopicRows.map((s) => s.id);
  if (!ids.length) return [];
  const textById = Object.fromEntries(subtopicRows.map((s) => [s.id, s.topicText]));

  const lessonRows = await db.select().from(lessons).where(inArray(lessons.subtopicId, ids));
  const moduleRows = await db.select().from(lessonModules).where(inArray(lessonModules.subtopicId, ids));

  const cards = [];
  for (const row of lessonRows) cards.push(...cardsFromLesson(row.subtopicId, textById[row.subtopicId], row));
  for (const row of moduleRows) cards.push(...cardsFromModule(row.subtopicId, textById[row.subtopicId], row));
  return cards;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const pool = await derivePool(userId);
    if (pool === null) return NextResponse.json({ error: "onboarding_not_complete" }, { status: 409 });
    if (!pool.length) return NextResponse.json({ cards: [], totalCards: 0 });

    const reviewRows = await db
      .select()
      .from(flashcardReviews)
      .where(and(eq(flashcardReviews.userId, userId), inArray(flashcardReviews.cardId, pool.map((c) => c.id))));
    const reviewByCardId = Object.fromEntries(reviewRows.map((r) => [r.cardId, r]));

    const now = new Date();
    const due = pool.filter((c) => {
      const r = reviewByCardId[c.id];
      return !r || new Date(r.dueAt) <= now;
    });

    return NextResponse.json({ cards: shuffle(due).slice(0, MAX_DUE_PER_SESSION), totalCards: pool.length, totalDue: due.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { cardId, subtopicId, quality } = await request.json();
    if (!cardId || !subtopicId || !(quality in QUALITY)) {
      return NextResponse.json({ error: "cardId, subtopicId, and quality ('again'|'good'|'easy') are required" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(flashcardReviews)
      .where(and(eq(flashcardReviews.userId, userId), eq(flashcardReviews.cardId, cardId)));

    const nextState = reviewCard(
      { easeFactor: existing?.easeFactor ?? DEFAULT_EASE_FACTOR, intervalDays: existing?.intervalDays ?? 0, repetitions: existing?.repetitions ?? 0 },
      QUALITY[quality]
    );
    const now = new Date();
    const dueAt = new Date(now.getTime() + nextState.intervalDays * 24 * 60 * 60 * 1000);

    if (existing) {
      await db
        .update(flashcardReviews)
        .set({ ...nextState, dueAt, lastReviewedAt: now })
        .where(and(eq(flashcardReviews.userId, userId), eq(flashcardReviews.cardId, cardId)));
    } else {
      await db.insert(flashcardReviews).values({ userId, cardId, subtopicId, ...nextState, dueAt, lastReviewedAt: now });
    }

    return NextResponse.json({ intervalDays: nextState.intervalDays, dueAt });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
