// app/api/papers/route.js
//
// Top-level dashboard data: one row per lib/subjects/papers.js's PAPER_TILES
// entry, enriched with this user's subtopic count / average mastery for that
// (subjectId, paper). A tile with subtopicCount:0 is a real paper with no
// content yet -- the client renders it as "coming soon" rather than this
// route hiding it, per explicit product choice.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, mastery } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { PAPER_TILES } from "../../../lib/subjects/papers.js";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const allSubtopics = await db.select({ id: subtopics.id, subjectId: subtopics.subjectId, paper: subtopics.paper }).from(subtopics);
    const allMastery = await db
      .select({ subtopicId: mastery.subtopicId, masteryScore: mastery.masteryScore })
      .from(mastery)
      .where(eq(mastery.userId, userId));
    const masteryBySubtopic = Object.fromEntries(allMastery.map((m) => [m.subtopicId, m.masteryScore]));

    const tiles = PAPER_TILES.map((tile) => {
      const inPaper = allSubtopics.filter((s) => s.subjectId === tile.subjectId && s.paper === tile.paper);
      const subtopicCount = inPaper.length;
      const avgMasteryScore = subtopicCount
        ? inPaper.reduce((sum, s) => sum + (masteryBySubtopic[s.id] ?? 0), 0) / subtopicCount
        : null;
      return { ...tile, subtopicCount, avgMasteryScore };
    });

    return NextResponse.json({ tiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
