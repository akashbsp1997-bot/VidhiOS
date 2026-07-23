// app/api/model-answer/route.js
//
// POST { subtopicId, questionSource, questionRefId } -> a model answer for
// this question, generated once (one AI call) and cached forever after --
// the free, instant self-check alternative to full AI grading (see
// lib/ai/generateModelAnswer.js's header comment for why this is a real
// quota-saving lever, not just a UX nicety). questionText/marks are always
// re-derived server-side from the real pyqs/model_questions row, never
// trusted from the client, so a cached answer can never drift from what
// the question actually is.
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, pyqs, modelQuestions, questionModelAnswers } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../lib/subjects/config.js";
import { generateModelAnswer } from "../../../lib/ai/generateModelAnswer.js";
import { isSubjectUnlocked } from "../../../lib/adaptive/subjectUnlockState.js";

export const maxDuration = 60;

async function resolveQuestion(questionSource, questionRefId) {
  if (questionSource === "pyq") {
    const [row] = await db.select().from(pyqs).where(eq(pyqs.id, questionRefId));
    return row ? { questionText: row.questionText, marks: row.marks, subtopicIds: row.topics } : null;
  }
  const [row] = await db.select().from(modelQuestions).where(eq(modelQuestions.id, Number(questionRefId)));
  return row ? { questionText: row.questionText, marks: row.marks, subtopicIds: [row.subtopicId] } : null;
}

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { subtopicId, questionSource, questionRefId } = await request.json();
    if (!subtopicId || !questionSource || !questionRefId) {
      return NextResponse.json({ error: "subtopicId, questionSource, and questionRefId are required" }, { status: 400 });
    }

    const [subtopicRow] = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    if (!subtopicRow) return NextResponse.json({ error: "Unknown subtopic" }, { status: 404 });
    if (!(await isSubjectUnlocked(userId, subtopicRow.subjectId))) {
      return NextResponse.json({ error: "subject_locked" }, { status: 403 });
    }

    const question = await resolveQuestion(questionSource, questionRefId);
    if (!question || !question.subtopicIds.includes(subtopicId)) {
      return NextResponse.json({ error: "Unknown question for this subtopic" }, { status: 404 });
    }

    const [existing] = await db
      .select()
      .from(questionModelAnswers)
      .where(and(eq(questionModelAnswers.questionSource, questionSource), eq(questionModelAnswers.questionRefId, String(questionRefId))));
    if (existing) {
      return NextResponse.json({ modelAnswer: existing.modelAnswer, keyPoints: existing.keyPoints });
    }

    const generated = await generateModelAnswer({
      questionText: question.questionText,
      marks: question.marks,
      subtopicText: subtopicRow.topicText,
      subjectConfig: getSubjectConfig(subtopicRow.subjectId),
    });

    const [saved] = await db
      .insert(questionModelAnswers)
      .values({ questionSource, questionRefId: String(questionRefId), ...generated })
      .onConflictDoNothing({ target: [questionModelAnswers.questionSource, questionModelAnswers.questionRefId] })
      .returning();

    const result = saved ?? { ...generated };
    return NextResponse.json({ modelAnswer: result.modelAnswer, keyPoints: result.keyPoints });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
