// app/api/essay-guide/route.js
//
// GET ?topicId= -> this topic's planning guide -- generated once (one AI
// call) on first request, cached, and reused for every student after (same
// pattern as app/api/lesson's Teach content). Never a ready-made essay,
// just angles/structure to plan from.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { essayTopics, essayGuides } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { generateEssayGuide } from "../../../lib/ai/generateEssayGuide.js";

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");
    if (!topicId) return NextResponse.json({ error: "topicId is required" }, { status: 400 });

    const [topic] = await db.select().from(essayTopics).where(eq(essayTopics.id, topicId));
    if (!topic) return NextResponse.json({ error: `Unknown essay topic: ${topicId}` }, { status: 404 });

    const [existing] = await db.select().from(essayGuides).where(eq(essayGuides.essayTopicId, topicId));
    if (existing) {
      return NextResponse.json({
        topic,
        approachNotes: existing.approachNotes,
        keyDimensions: existing.keyDimensions,
        quotesAndReferences: existing.quotesAndReferences,
        sampleOutline: existing.sampleOutline,
      });
    }

    const generated = await generateEssayGuide({ topicText: topic.topicText, category: topic.category });
    const [saved] = await db
      .insert(essayGuides)
      .values({ essayTopicId: topicId, ...generated })
      .onConflictDoNothing({ target: essayGuides.essayTopicId })
      .returning();

    // onConflictDoNothing returns [] if a concurrent request won the race --
    // re-read rather than assume `saved` exists.
    const guide = saved ?? (await db.select().from(essayGuides).where(eq(essayGuides.essayTopicId, topicId)))[0];

    return NextResponse.json({
      topic,
      approachNotes: guide.approachNotes,
      keyDimensions: guide.keyDimensions,
      quotesAndReferences: guide.quotesAndReferences,
      sampleOutline: guide.sampleOutline,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
