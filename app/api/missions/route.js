// app/api/missions/route.js
//
// GET -> today's 3 daily missions (completed:boolean each) plus this user's
// gamification profile (xp, streak). Read-only -- missions are recorded as
// a side effect of the real actions themselves (see lib/gamification/
// missions.js's recordMissionSafe, called from lesson/module-lesson/
// attempt/mcq/mock-tests/essay-attempt), never completed directly through
// this route.
import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { todaysMissionStatus, loadPlayerState } from "../../../lib/gamification/missions.js";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const [missions, playerState] = await Promise.all([todaysMissionStatus(userId), loadPlayerState(userId)]);
    return NextResponse.json({ missions, playerState });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
