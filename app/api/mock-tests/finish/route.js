// app/api/mock-tests/finish/route.js
//
// POST { mockTestId } -> closes out a mock test after the client has looped
// through grade-question for every answered question: marks submittedAt
// only. totalScore is left null and computed later by
// app/api/cron/grade-daily-answers/route.js, once every answered question in
// this test has been graded overnight (see the 2026-07-24
// overnight-batch-grading change -- grade-question no longer grades inline,
// so there's nothing to sum yet at submit time). A question the student
// never answered (answerText still null) is never sent for grading and
// counts as 0 marks in that later sum, same as it always did here.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { mockTests } from "../../../../db/schema.js";
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

    await db.update(mockTests).set({ submittedAt: new Date() }).where(eq(mockTests.id, test.id));

    return NextResponse.json({ pending: true, totalMarks: test.totalMarks });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
