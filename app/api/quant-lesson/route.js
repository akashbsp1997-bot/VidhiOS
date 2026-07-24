// app/api/quant-lesson/route.js
//
// GET ?subtopicId= -> a CSAT quant subtopic's short "explanation + shortcuts"
// refresher -- generated once (one AI call) on first request, cached, and
// reused for every student after (same "generate once, cache forever"
// pattern as app/api/essay-guide). See lib/ai/generateQuantLesson.js and
// components/QuantPuzzleChain.jsx.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, quantLessons } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../lib/subjects/config.js";
import { generateQuantLesson } from "../../../lib/ai/generateQuantLesson.js";

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const subtopicId = searchParams.get("subtopicId");
    if (!subtopicId) return NextResponse.json({ error: "subtopicId is required" }, { status: 400 });

    const [subtopicRow] = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    if (!subtopicRow) return NextResponse.json({ error: `Unknown subtopic: ${subtopicId}` }, { status: 404 });

    const [existing] = await db.select().from(quantLessons).where(eq(quantLessons.subtopicId, subtopicId));
    if (existing) {
      return NextResponse.json({ subtopicId, explanation: existing.explanation, shortcuts: existing.shortcuts });
    }

    const generated = await generateQuantLesson({
      subtopicText: subtopicRow.topicText,
      subjectConfig: getSubjectConfig(subtopicRow.subjectId),
    });
    const [saved] = await db
      .insert(quantLessons)
      .values({ subtopicId, explanation: generated.explanation, shortcuts: generated.shortcuts })
      .onConflictDoNothing({ target: quantLessons.subtopicId })
      .returning();

    // onConflictDoNothing returns [] if a concurrent request won the race.
    const lesson = saved ?? (await db.select().from(quantLessons).where(eq(quantLessons.subtopicId, subtopicId)))[0];

    return NextResponse.json({ subtopicId, explanation: lesson.explanation, shortcuts: lesson.shortcuts });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
