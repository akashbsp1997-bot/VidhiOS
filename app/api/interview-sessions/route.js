// app/api/interview-sessions/route.js
//
// GET            -> this user's past mock interview sessions (history list).
// GET ?id=<id>   -> one session's full state (questions + self-reflection notes).
// POST           -> generates a new mock question set (one AI call), grounded
//      in the candidate's saved DAF-style profile, their chosen optional
//      subject, and (if the opt-in current-affairs digest has data) a
//      handful of recent headlines.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { interviewProfiles, interviewSessions, subjects, currentAffairsItems } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { loadUnlockedSubjectIds } from "../../../lib/adaptive/subjectUnlockState.js";
import { generateInterviewQuestions } from "../../../lib/ai/generateInterviewQuestions.js";

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const [session] = await db.select().from(interviewSessions).where(eq(interviewSessions.id, Number(id)));
      if (!session || session.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ id: session.id, questions: session.questions, notes: session.notes, createdAt: session.createdAt });
    }

    const rows = await db.select().from(interviewSessions).where(eq(interviewSessions.userId, userId)).orderBy(desc(interviewSessions.createdAt));
    return NextResponse.json({ sessions: rows.map((r) => ({ id: r.id, questionCount: r.questions.length, createdAt: r.createdAt })) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const [profileRow] = await db.select().from(interviewProfiles).where(eq(interviewProfiles.userId, userId));
    const profile = {
      hometown: profileRow?.hometown ?? "",
      education: profileRow?.education ?? "",
      workExperience: profileRow?.workExperience ?? "",
      hobbies: profileRow?.hobbies ?? "",
      servicePreference: profileRow?.servicePreference ?? "",
    };

    const { optionalSubjectId } = await loadUnlockedSubjectIds(userId);
    let optionalSubjectName = null;
    if (optionalSubjectId) {
      const [subjectRow] = await db.select({ displayName: subjects.displayName }).from(subjects).where(eq(subjects.id, optionalSubjectId));
      optionalSubjectName = subjectRow?.displayName ?? null;
    }

    const recentAffairs = await db.select({ title: currentAffairsItems.title }).from(currentAffairsItems).orderBy(desc(currentAffairsItems.createdAt)).limit(5);

    const questions = await generateInterviewQuestions({
      profile,
      optionalSubjectName,
      recentHeadlines: recentAffairs.map((r) => r.title),
    });

    const [session] = await db.insert(interviewSessions).values({ userId, questions }).returning();

    return NextResponse.json({ id: session.id, questions: session.questions, createdAt: session.createdAt });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
