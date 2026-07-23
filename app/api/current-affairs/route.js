// app/api/current-affairs/route.js
//
// GET ?days=<n> -> recent current-affairs digest items (default 7 days,
// capped at 30), each with the real subtopics it's tagged against resolved
// to display text. Populated by app/api/cron/fetch-current-affairs -- this
// route is read-only and makes no AI calls.
import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { currentAffairsItems, subtopics } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(30, Math.max(1, Number(searchParams.get("days")) || 7));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const rows = await db.select().from(currentAffairsItems).orderBy(desc(currentAffairsItems.createdAt)).limit(200);
    const recent = rows.filter((r) => r.publishedDate >= cutoff);

    const allSubtopicIds = [...new Set(recent.flatMap((r) => r.relatedSubtopicIds ?? []))];
    const subtopicRows = allSubtopicIds.length
      ? await db.select({ id: subtopics.id, topicText: subtopics.topicText }).from(subtopics).where(inArray(subtopics.id, allSubtopicIds))
      : [];
    const textById = Object.fromEntries(subtopicRows.map((s) => [s.id, s.topicText]));

    return NextResponse.json({
      items: recent.map((r) => ({
        id: r.id,
        publishedDate: r.publishedDate,
        title: r.title,
        summary: r.summary,
        sourceUrl: r.sourceUrl,
        sourceName: r.sourceName,
        relatedTopics: (r.relatedSubtopicIds ?? []).map((id) => ({ id, topicText: textById[id] })).filter((t) => t.topicText),
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
