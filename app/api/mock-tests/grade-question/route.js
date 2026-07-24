// app/api/mock-tests/grade-question/route.js
//
// POST { mockTestId, mockTestQuestionId, answerText } -> SAVES one question's
// answer only, no AI grading call here anymore (see the 2026-07-24
// overnight-batch-grading change) -- grading happens later, in
// app/api/cron/grade-daily-answers/route.js's nightly run, which also sums
// mockTests.totalScore once every question in a test is graded (that used
// to happen in ../finish/route.js at submit time; moved to the cron since
// grading no longer finishes within the same request/day). Called once per
// question, in a client-side loop, when the student submits the whole test.
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { mockTests, mockTestQuestions } from "../../../../db/schema.js";
import { getSessionUserId } from "../../../../lib/supabase/server.js";
import { recordMissionSafe } from "../../../../lib/gamification/missions.js";

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { mockTestId, mockTestQuestionId, answerText } = await request.json();
    if (!mockTestId || !mockTestQuestionId || typeof answerText !== "string") {
      return NextResponse.json({ error: "mockTestId, mockTestQuestionId, and answerText are required" }, { status: 400 });
    }

    const [test] = await db.select().from(mockTests).where(eq(mockTests.id, Number(mockTestId)));
    if (!test || test.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (test.submittedAt) return NextResponse.json({ error: "This mock test has already been submitted." }, { status: 409 });

    const [question] = await db.select().from(mockTestQuestions).where(eq(mockTestQuestions.id, Number(mockTestQuestionId)));
    if (!question || question.mockTestId !== test.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.update(mockTestQuestions).set({ answerText }).where(eq(mockTestQuestions.id, question.id));

    await recordMissionSafe(userId, "practice");

    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
