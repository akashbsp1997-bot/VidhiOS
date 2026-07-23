// app/api/notes-export/route.js
//
// GET -> a full export of this user's unlocked subjects, grouped by
// (subject, section), each subtopic carrying its personal notes
// (mastery.notes/selfStatus), AI-generated key points already produced by a
// real Teach visit, and current mastery -- everything app/notes/export/
// page.jsx needs to render one clean printable document. Reuses data
// already tracked, same principle as the theme guide and flashcards --
// nothing here is freshly generated.
import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subtopics, mastery, subjects, lessons, lessonModules } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { loadUnlockedSubjectIds } from "../../../lib/adaptive/subjectUnlockState.js";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
    const unlockedSubjectIds = optionalSubjectId ? [...unlockedGsIds, optionalSubjectId] : unlockedGsIds;
    if (!unlockedSubjectIds.length) {
      return NextResponse.json({ error: "onboarding_not_complete" }, { status: 409 });
    }

    const subjectRows = await db.select({ id: subjects.id, displayName: subjects.displayName }).from(subjects).where(inArray(subjects.id, unlockedSubjectIds));
    const subjectById = Object.fromEntries(subjectRows.map((s) => [s.id, s]));

    const subtopicRows = await db.select().from(subtopics).where(inArray(subtopics.subjectId, unlockedSubjectIds));
    const ids = subtopicRows.map((s) => s.id);
    if (!ids.length) return NextResponse.json({ sections: [] });

    const masteryRows = await db.select().from(mastery).where(eq(mastery.userId, userId));
    const masteryBySubtopic = Object.fromEntries(masteryRows.map((m) => [m.subtopicId, m]));

    const lessonRows = await db.select({ subtopicId: lessons.subtopicId, keyProvisions: lessons.keyProvisions }).from(lessons).where(inArray(lessons.subtopicId, ids));
    const moduleRows = await db
      .select({ subtopicId: lessonModules.subtopicId, keyPoints: lessonModules.keyPoints, generatedAt: lessonModules.generatedAt })
      .from(lessonModules)
      .where(inArray(lessonModules.subtopicId, ids));

    const keyPointsBySubtopic = {};
    for (const row of lessonRows) {
      const bullets = (row.keyProvisions ?? [])
        .filter((p) => p && typeof p.citation === "string" && typeof p.summary === "string")
        .map((p) => `${p.citation}: ${p.summary}`);
      (keyPointsBySubtopic[row.subtopicId] ??= []).push(...bullets);
    }
    for (const row of moduleRows) {
      if (row.generatedAt) (keyPointsBySubtopic[row.subtopicId] ??= []).push(...(row.keyPoints ?? []));
    }

    // (subjectId, section) composite key -- same convention as the
    // readiness heatmap, avoids two unrelated subjects colliding on a
    // reused section name.
    const buckets = {};
    for (const s of subtopicRows) {
      const key = `${s.subjectId}::${s.section}`;
      (buckets[key] ??= { subjectId: s.subjectId, section: s.section, subtopics: [] }).subtopics.push(s);
    }

    const sections = Object.values(buckets)
      .map((b) => ({
        subjectId: b.subjectId,
        subjectDisplayName: subjectById[b.subjectId]?.displayName ?? b.subjectId,
        section: b.section,
        subtopics: b.subtopics
          .sort((a, c) => a.id.localeCompare(c.id))
          .map((s) => ({
            id: s.id,
            topicText: s.topicText,
            masteryScore: masteryBySubtopic[s.id]?.masteryScore ?? 0,
            selfStatus: masteryBySubtopic[s.id]?.selfStatus ?? "not-started",
            personalNotes: masteryBySubtopic[s.id]?.notes ?? "",
            aiKeyPoints: keyPointsBySubtopic[s.id] ?? [],
          })),
      }))
      .sort((a, b) => a.subjectId.localeCompare(b.subjectId) || a.section.localeCompare(b.section));

    return NextResponse.json({ sections });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
