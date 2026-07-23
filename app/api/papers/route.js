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
import { PAPER_TILES, isOptionalTile } from "../../../lib/subjects/papers.js";
import { GS_UNLOCK_ORDER } from "../../../lib/adaptive/subjectUnlocks.js";
import { loadUnlockedSubjectIds, hasStartedOnboarding, maybeUnlockNextGsSubject } from "../../../lib/adaptive/subjectUnlockState.js";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    // Opportunistic check-and-unlock -- the dashboard load IS the "on
    // schedule" trigger point for the calendar half of the unlock rule (see
    // lib/adaptive/subjectUnlocks.js's nextGsUnlock); no cron needed.
    const newlyUnlockedGsSubjectId = (await hasStartedOnboarding(userId)) ? await maybeUnlockNextGsSubject(userId) : null;

    const onboardingComplete = await hasStartedOnboarding(userId);
    const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);

    const allSubtopics = await db.select({ id: subtopics.id, subjectId: subtopics.subjectId, paper: subtopics.paper }).from(subtopics);
    const allMastery = await db
      .select({ subtopicId: mastery.subtopicId, masteryScore: mastery.masteryScore })
      .from(mastery)
      .where(eq(mastery.userId, userId));
    const masteryBySubtopic = Object.fromEntries(allMastery.map((m) => [m.subtopicId, m.masteryScore]));

    // Distinct from "coming soon" (subtopicCount:0, a real but empty paper):
    // a subject-locked tile has content, the student just can't reach it
    // yet. GS tiles lock by subjectId; every optional-subject tile (general
    // + literature) locks unless it's this user's one chosen optional --
    // qualifying/prelims/essay tiles are never gated (see GATED_CATEGORIES).
    const tiles = PAPER_TILES.map((tile) => {
      const inPaper = allSubtopics.filter((s) => s.subjectId === tile.subjectId && s.paper === tile.paper);
      const subtopicCount = inPaper.length;
      const avgMasteryScore = subtopicCount
        ? inPaper.reduce((sum, s) => sum + (masteryBySubtopic[s.id] ?? 0), 0) / subtopicCount
        : null;
      const subjectLocked = GS_UNLOCK_ORDER.includes(tile.subjectId)
        ? !unlockedGsIds.includes(tile.subjectId)
        : isOptionalTile(tile)
          ? tile.subjectId !== optionalSubjectId
          : false;
      return { ...tile, subtopicCount, avgMasteryScore, subjectLocked };
    });

    return NextResponse.json({ tiles, onboardingComplete, unlockedGsIds, optionalSubjectId, newlyUnlockedGsSubjectId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
