// app/api/essay-topics/route.js
//
// GET               -> all essay topics, grouped by category for browsing.
// GET ?random=true  -> one random topic (optionally ?category=<cat>).
// Read-only, no AI calls -- the topic bank itself is static seed data (see
// db/seed/essay-topics.js).
import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { essayTopics } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const random = searchParams.get("random") === "true";
    const category = searchParams.get("category");

    if (random) {
      let pool = await db.select().from(essayTopics);
      if (category) pool = pool.filter((t) => t.category === category);
      if (!pool.length) return NextResponse.json({ error: "No topics found." }, { status: 404 });
      const topic = pool[Math.floor(Math.random() * pool.length)];
      return NextResponse.json({ topic });
    }

    const rows = await db.select().from(essayTopics);
    const categories = {};
    for (const t of rows) (categories[t.category] ??= []).push(t);
    return NextResponse.json({
      totalTopics: rows.length,
      categories: Object.entries(categories)
        .map(([category, topics]) => ({ category, topics: topics.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)) }))
        .sort((a, b) => a.category.localeCompare(b.category)),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
