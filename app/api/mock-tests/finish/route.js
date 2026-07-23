// app/api/mock-tests/finish/route.js
//
// POST { mockTestId } -> closes out a mock test after the client has looped
// through grade-question for every answered question: marks submittedAt and
// computes totalScore. Any question the client never graded (skipped/left
// blank) is treated as 0 marks earned here rather than triggering its own
// grading call -- gradeAnswer already short-circuits an empty answer to a
// 0 score for free, so there's nothing to gain from calling it for a
// question with no persisted answerText at all.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { mockTests, mockTestQuestions } from "../../../../db/schema.js";
import { getSessionUserId } from "../../../../lib/supabase/server.js";

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { mockTestId } = await request.json();
    if (!mockTestId) return NextResponse.json({ error: "mockTestId is required" }, { status: 400 });

    const [test] = await db.select().from(mockTests).where(eq(mockTests.id, Number(mockTestId)));
    if (!test || test.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (test.submittedAt) return NextResponse.json({ error: "Already submitted", totalScore: test.totalScore }, { status: 409 });

    const questions = await db.select().from(mockTestQuestions).where(eq(mockTestQuestions.mockTestId, test.id));
    const totalScore = questions.reduce((sum, q) => sum + Math.round(((q.score ?? 0) / 100) * q.marks), 0);

    await db.update(mockTests).set({ submittedAt: new Date(), totalScore }).where(eq(mockTests.id, test.id));

    return NextResponse.json({ totalScore, totalMarks: test.totalMarks });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
