import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, sources, lessons, mastery } from "../../../db/schema.js";
import { generateLesson } from "../../../lib/ai/generateLesson.js";

const VALID_STAGES = ["teach", "grasp", "remember", "test"];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subtopicId = searchParams.get("subtopicId");
  if (!subtopicId) return NextResponse.json({ error: "subtopicId is required" }, { status: 400 });

  try {
    const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    const subtopicRow = subtopicRows[0];
    if (!subtopicRow) return NextResponse.json({ error: `Unknown subtopic: ${subtopicId}` }, { status: 404 });

    const existingRows = await db.select().from(lessons).where(eq(lessons.subtopicId, subtopicId));
    if (existingRows[0]) {
      return NextResponse.json({ subtopicId, subtopicText: subtopicRow.topicText, ...existingRows[0], cached: true });
    }

    const srcRows = await db.select().from(sources).where(eq(sources.subtopicId, subtopicId));
    const sourceExcerpts = srcRows.filter((s) => s.extractedText).map((s) => s.extractedText).slice(0, 2);

    const generated = await generateLesson({ subtopicText: subtopicRow.topicText, sourceExcerpts });

    const [inserted] = await db
      .insert(lessons)
      .values({ subtopicId, ...generated })
      .onConflictDoNothing({ target: lessons.subtopicId })
      .returning();

    const finalRows = inserted ? [inserted] : await db.select().from(lessons).where(eq(lessons.subtopicId, subtopicId));

    return NextResponse.json({ subtopicId, subtopicText: subtopicRow.topicText, ...finalRows[0], cached: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { subtopicId, stage } = await request.json();
    if (!subtopicId || !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: "subtopicId and a valid stage are required" }, { status: 400 });
    }

    const existingRows = await db.select().from(mastery).where(eq(mastery.subtopicId, subtopicId));
    if (existingRows[0]) {
      await db.update(mastery).set({ stage }).where(eq(mastery.subtopicId, subtopicId));
    } else {
      await db.insert(mastery).values({ subtopicId, stage });
    }

    return NextResponse.json({ subtopicId, stage });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
