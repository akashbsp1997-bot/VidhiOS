// app/api/essay-attempt/route.js
//
// GET ?topicId=  -> this user's past attempts on one topic.
// POST { topicId, essayText } -> grades the essay holistically (one AI
// call, see lib/ai/gradeEssay.js) and records the attempt. Unlike
// descriptive/MCQ/mock-test practice, this never touches `mastery` --
// Essay is its own paper with its own grading criteria, not something that
// feeds a GS subtopic's mastery score.
import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { essayTopics, essayAttempts } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
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
    const { topicId, essayText } = await request.json();
    if (!topicId || typeof essayText !== "string") {
      return NextResponse.json({ error: "topicId and essayText are required" }, { status: 400 });
    }

    const [topic] = await db.select().from(essayTopics).where(eq(essayTopics.id, topicId));
    if (!topic) return NextResponse.json({ error: `Unknown essay topic: ${topicId}` }, { status: 404 });

    const feedback = await gradeEssay({ topicText: topic.topicText, essayText });

    const [saved] = await db
      .insert(essayAttempts)
      .values({ userId, essayTopicId: topicId, essayText, score: feedback.score, feedback })
      .returning();

    return NextResponse.json({ id: saved.id, feedback });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
