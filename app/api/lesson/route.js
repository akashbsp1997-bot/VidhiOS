export const maxDuration = 60;

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, sources, lessons, mastery } from "../../../db/schema.js";
import { generateLesson } from "../../../lib/ai/generateLesson.js";
import { casesSeed } from "../../../db/seed/cases.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getSubjectConfig } from "../../../lib/subjects/config.js";

const VALID_STAGES = ["teach", "grasp", "remember", "test"];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subtopicId = searchParams.get("subtopicId");
  const force = searchParams.get("force") === "true";
  if (!subtopicId) return NextResponse.json({ error: "subtopicId is required" }, { status: 400 });

  try {
    const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    const subtopicRow = subtopicRows[0];
    if (!subtopicRow) return NextResponse.json({ error: `Unknown subtopic: ${subtopicId}` }, { status: 404 });

    const existingRows = await db.select().from(lessons).where(eq(lessons.subtopicId, subtopicId));
    if (existingRows[0] && !force) {
      return NextResponse.json({ subtopicId, subtopicText: subtopicRow.topicText, ...existingRows[0], cached: true });
    }

    const srcRows = await db.select().from(sources).where(eq(sources.subtopicId, subtopicId));
    const sourceExcerpts = srcRows.filter((s) => s.extractedText).map((s) => s.extractedText).slice(0, 2);
    const caseAnchors = casesSeed
      .filter((c) => c.topics.includes(subtopicId))
      .map((c) => ({ case: c.case, point: c.point }));

    const subjectConfig = getSubjectConfig(subtopicRow.subjectId);
    const generated = await generateLesson({ subtopicText: subtopicRow.topicText, sourceExcerpts, caseAnchors, subjectConfig });

    const [saved] = await db
      .insert(lessons)
      .values({ subtopicId, ...generated })
      .onConflictDoUpdate({ target: lessons.subtopicId, set: { ...generated, generatedAt: new Date() } })
      .returning();

    return NextResponse.json({ subtopicId, subtopicText: subtopicRow.topicText, ...saved, cached: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { subtopicId, stage } = await request.json();
    if (!subtopicId || !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: "subtopicId and a valid stage are required" }, { status: 400 });
    }

    const existingRows = await db
      .select()
      .from(mastery)
      .where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
    if (existingRows[0]) {
      await db
        .update(mastery)
        .set({ stage })
        .where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
    } else {
      await db.insert(mastery).values({ userId, subtopicId, stage });
    }

    return NextResponse.json({ subtopicId, stage });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
