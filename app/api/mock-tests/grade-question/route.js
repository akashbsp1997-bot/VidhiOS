// app/api/mock-tests/grade-question/route.js
//
// POST { mockTestId, mockTestQuestionId, answerText } -> grades ONE question
// of a mock test (one AI call) and persists the answer + score + feedback.
// Called once per question, in a client-side loop, when the student submits
// the whole test -- never batched server-side, so a 20-question full mock
// never risks one request exceeding the serverless time limit (same "at
// most one AI phase per request" discipline as app/api/lesson).
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { mockTests, mockTestQuestions, subtopics } from "../../../../db/schema.js";
import { getSessionUserId } from "../../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../../lib/subjects/config.js";
import { gradeAnswer } from "../../../../lib/ai/grade.js";

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

    const [subtopicRow] = await db.select().from(subtopics).where(eq(subtopics.id, question.subtopicId));

    const feedback = await gradeAnswer({
      questionText: question.questionText,
      marks: question.marks,
      subtopicText: subtopicRow?.topicText ?? question.subtopicId,
      answerText,
      subjectConfig: getSubjectConfig(test.subjectId),
    });

    await db
      .update(mockTestQuestions)
      .set({ answerText, score: feedback.score, feedback })
      .where(eq(mockTestQuestions.id, question.id));

    return NextResponse.json({ score: feedback.score, feedback });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
