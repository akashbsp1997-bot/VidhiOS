// app/api/subtopics/route.js
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, mastery, sources } from "../../../db/schema.js";

export async function GET() {
  try {
    const allSubtopics = await db.select().from(subtopics);
    const allMastery = await db.select().from(mastery);
    const sourceCounts = await db
      .select({ subtopicId: sources.subtopicId, count: sql`count(*)`.mapWith(Number) })
      .from(sources)
      .groupBy(sources.subtopicId);

    const masteryBySubtopic = Object.fromEntries(allMastery.map((m) => [m.subtopicId, m]));
    const sourceCountBySubtopic = Object.fromEntries(sourceCounts.map((s) => [s.subtopicId, s.count]));

    const result = allSubtopics
      .map((s) => ({
        id: s.id,
        paper: s.paper,
        section: s.section,
        topicText: s.topicText,
        pyqFrequency: s.pyqFrequency,
        masteryScore: masteryBySubtopic[s.id]?.masteryScore ?? 0,
        currentTier: masteryBySubtopic[s.id]?.currentTier ?? 1,
        attemptsCount: masteryBySubtopic[s.id]?.attemptsCount ?? 0,
        sourceCount: sourceCountBySubtopic[s.id] ?? 0,
      }))
      .sort((a, b) => b.pyqFrequency - a.pyqFrequency || a.id.localeCompare(b.id));

    return NextResponse.json({ subtopics: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
