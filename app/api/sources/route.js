// app/api/sources/route.js
// GET ?subtopicId=CA1 -> all registered sources for that subtopic.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { sources, subtopics, subjects } from "../../../db/schema.js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subtopicId = searchParams.get("subtopicId");
  if (!subtopicId) return NextResponse.json({ error: "subtopicId is required" }, { status: 400 });

  try {
    const subtopicRows = await db.select().from(subtopics).where(eq(subtopics.id, subtopicId));
    if (!subtopicRows[0]) return NextResponse.json({ error: "Unknown subtopic" }, { status: 404 });

    const subjectRows = await db.select().from(subjects).where(eq(subjects.id, subtopicRows[0].subjectId));
    const subject = { subjectDisplayName: subjectRows[0]?.displayName ?? subtopicRows[0].subjectId };

    const rows = await db.select().from(sources).where(eq(sources.subtopicId, subtopicId));
    return NextResponse.json({ subtopic: { ...subtopicRows[0], ...subject }, sources: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
