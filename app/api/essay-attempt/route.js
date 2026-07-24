// app/api/essay-attempt/route.js
//
// GET ?topicId=  -> this user's past attempts on one topic.
// POST { topicId, essayText, gradeNow? } -> saves the essay. By default
// (gradeNow omitted/false) grading is deferred to
// app/api/cron/grade-daily-answers/route.js's nightly batch, same as
// /api/attempt (see the 2026-07-24 overnight-batch-grading change) --
// response is { id, pending: true }. `gradeNow: true` keeps the OLD
// synchronous behavior ({ id, feedback }) and is reserved for
// components/EssayTournament.jsx specifically: its round-advance is a
// real-time game mechanic (pass/fail decided the instant the score comes
// back), which deferred grading would break outright, not just delay --
// see that component and the plan doc for the full reasoning. Unlike
// descriptive/MCQ/mock-test practice, this never touches `mastery` -- Essay
// is its own paper with its own grading criteria, not something that feeds
// a GS subtopic's mastery score.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { essayTopics, essayAttempts } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { checkLockdown } from "../../../lib/adaptive/subjectUnlockState.js";
import { isPassingScore } from "../../../lib/adaptive/scoring.js";
import { recordMissionSafe } from "../../../lib/gamification/missions.js";
import { gradeEssay } from "../../../lib/ai/gradeEssay.js";

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");
    const rows = topicId
      ? await db.select().from(essayAttempts).where(and(eq(essayAttempts.userId, userId), eq(essayAttempts.essayTopicId, topicId))).orderBy(desc(essayAttempts.createdAt))
      : await db.select().from(essayAttempts).where(eq(essayAttempts.userId, userId)).orderBy(desc(essayAttempts.createdAt));

    return NextResponse.json({ attempts: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const lockdown = await checkLockdown(userId);
    if (lockdown) return NextResponse.json({ error: "locked_down", ...lockdown }, { status: 403 });

    const { topicId, essayText, gradeNow } = await request.json();
    if (!topicId || typeof essayText !== "string") {
      return NextResponse.json({ error: "topicId and essayText are required" }, { status: 400 });
    }

    const [topic] = await db.select().from(essayTopics).where(eq(essayTopics.id, topicId));
    if (!topic) return NextResponse.json({ error: `Unknown essay topic: ${topicId}` }, { status: 404 });

    if (gradeNow === true) {
      const feedback = await gradeEssay({ topicText: topic.topicText, essayText });
      const [saved] = await db
        .insert(essayAttempts)
        .values({ userId, essayTopicId: topicId, essayText, score: feedback.score, feedback })
        .returning();
      await recordMissionSafe(userId, "practice");
      if (isPassingScore(feedback.score)) await recordMissionSafe(userId, "pass");
      return NextResponse.json({ id: saved.id, feedback });
    }

    const [saved] = await db
      .insert(essayAttempts)
      .values({ userId, essayTopicId: topicId, essayText, score: null, feedback: null })
      .returning();

    await recordMissionSafe(userId, "practice");

    return NextResponse.json({ id: saved.id, pending: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
