// app/api/onboarding/route.js
//
// GET  -> this user's current subject-unlock state, plus the data the
//      onboarding picker needs (recommended GS default, the 48 optional
//      choices) -- so app/onboarding/page.jsx never needs a second endpoint.
// POST { gsSubjectIds, optionalSubjectId } -> one-time initialization (see
//      lib/adaptive/subjectUnlockState.js's initializeSubjectUnlocks). 409
//      if onboarding already ran for this user -- re-picking is a distinct,
//      deliberate settings action, not something this route does silently.
import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";
import { subjects } from "../../../db/schema.js";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getOptionalSubjects } from "../../../lib/subjects/papers.js";
import { RECOMMENDED_INITIAL_GS_SUBJECT_IDS, GS_UNLOCK_ORDER } from "../../../lib/adaptive/subjectUnlocks.js";
import { hasStartedOnboarding, loadUnlockedSubjectIds, initializeSubjectUnlocks } from "../../../lib/adaptive/subjectUnlockState.js";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const onboardingComplete = await hasStartedOnboarding(userId);
    const { unlockedGsIds, optionalSubjectId } = await loadUnlockedSubjectIds(userId);
    const gsSubjects = await db
      .select({ id: subjects.id, displayName: subjects.displayName })
      .from(subjects)
      .where(eq(subjects.category, "gs"));
    const gsOrdered = GS_UNLOCK_ORDER.map((id) => gsSubjects.find((s) => s.id === id)).filter(Boolean);

    return NextResponse.json({
      onboardingComplete,
      unlockedGsIds,
      optionalSubjectId,
      recommendedGsSubjectIds: RECOMMENDED_INITIAL_GS_SUBJECT_IDS,
      gsSubjects: gsOrdered,
      optionalSubjects: getOptionalSubjects(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { gsSubjectIds, optionalSubjectId } = await request.json();
    await initializeSubjectUnlocks(userId, { gsSubjectIds, optionalSubjectId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const alreadyDone = /already initialized/i.test(err.message);
    return NextResponse.json({ error: err.message }, { status: alreadyDone ? 409 : 400 });
  }
}
