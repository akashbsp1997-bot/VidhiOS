// app/api/interview-sessions/notes/route.js
//
// POST { sessionId, questionIndex, note } -> saves the candidate's own
// post-hoc self-reflection for one question in a session (e.g. "rambled,
// need a tighter answer") -- never AI-graded, same self-declared spirit as
// mastery.notes.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { interviewSessions } from "../../../../db/schema.js";
import { getSessionUserId } from "../../../../lib/supabase/server.js";

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { sessionId, questionIndex, note } = await request.json();
    if (!sessionId || typeof questionIndex !== "number" || typeof note !== "string") {
      return NextResponse.json({ error: "sessionId, questionIndex, and note are required" }, { status: 400 });
    }

    const [session] = await db.select().from(interviewSessions).where(eq(interviewSessions.id, Number(sessionId)));
    if (!session || session.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const notes = { ...(session.notes ?? {}), [String(questionIndex)]: note.slice(0, 1000) };
    await db.update(interviewSessions).set({ notes }).where(eq(interviewSessions.id, session.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
