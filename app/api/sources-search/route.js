// app/api/sources-search/route.js
//
// GET ?q=<text>&tier=<tier> -> a cross-subject search over sources already
// registered in this user's unlocked subjects (NCERT/official/newspaper/
// external) -- the "static GK reference" piece, deliberately built as a
// search over real, already-vetted sources rather than an AI-answered
// lookup: zero fabrication risk, at the honest cost of only being as
// complete as what's been registered/ingested so far. `q` is optional --
// omit it to browse everything (tier-sorted, capped).
import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, sources } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { loadUnlockedSubjectIds } from "../../../lib/adaptive/subjectUnlockState.js";
import { sortByTierPriority } from "../../../lib/sources/tiers.js";

const MAX_RESULTS = 50;

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
    const unlockedSubjectIds = optionalSubjectId ? [...unlockedGsIds, optionalSubjectId] : unlockedGsIds;
    if (!unlockedSubjectIds.length) {
      return NextResponse.json({ error: "onboarding_not_complete" }, { status: 409 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const tier = searchParams.get("tier") || null;

    const subtopicRows = await db.select({ id: subtopics.id, topicText: subtopics.topicText }).from(subtopics).where(inArray(subtopics.subjectId, unlockedSubjectIds));
    const ids = subtopicRows.map((s) => s.id);
    if (!ids.length) return NextResponse.json({ results: [], totalMatched: 0 });
    const textById = Object.fromEntries(subtopicRows.map((s) => [s.id, s.topicText]));

    const sourceRows = await db.select().from(sources).where(inArray(sources.subtopicId, ids));

    let matched = sourceRows.filter((s) => {
      if (tier && s.sourceTier !== tier) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q) || (s.extractedText || "").toLowerCase().includes(q);
    });
    matched = sortByTierPriority(matched);
    const totalMatched = matched.length;

    return NextResponse.json({
      results: matched.slice(0, MAX_RESULTS).map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        sourceTier: s.sourceTier,
        subtopicId: s.subtopicId,
        subtopicText: textById[s.subtopicId] ?? s.subtopicId,
      })),
      totalMatched,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
