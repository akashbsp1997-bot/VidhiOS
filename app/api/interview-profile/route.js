// app/api/interview-profile/route.js
//
// GET  -> this user's saved DAF-style background (defaults to empty strings
//      if never saved).
// POST { hometown?, education?, workExperience?, hobbies?, servicePreference? }
//      -> upserts a partial update, same pattern as app/api/subtopic-notes.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { interviewProfiles } from "../../../db/schema.js";
import { getSessionUserId } from "../../../lib/supabase/server.js";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const [row] = await db.select().from(interviewProfiles).where(eq(interviewProfiles.userId, userId));
    return NextResponse.json({
      hometown: row?.hometown ?? "",
      education: row?.education ?? "",
      workExperience: row?.workExperience ?? "",
      hobbies: row?.hobbies ?? "",
      servicePreference: row?.servicePreference ?? "",
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
    const body = await request.json();
    const update = {};
    for (const field of ["hometown", "education", "workExperience", "hobbies", "servicePreference"]) {
      if (typeof body[field] === "string") update[field] = body[field].slice(0, 1000);
    }

    const [existing] = await db.select({ userId: interviewProfiles.userId }).from(interviewProfiles).where(eq(interviewProfiles.userId, userId));
    if (existing) {
      await db.update(interviewProfiles).set({ ...update, updatedAt: new Date() }).where(eq(interviewProfiles.userId, userId));
    } else {
      await db.insert(interviewProfiles).values({ userId, ...update });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
