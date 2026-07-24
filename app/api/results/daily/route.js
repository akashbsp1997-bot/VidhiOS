// app/api/results/daily/route.js
//
// GET ?date=YYYY-MM-DD -> this user's cached dailyResultsDigests row for that
// day, written once nightly by app/api/cron/grade-daily-answers/route.js
// (pure arithmetic over that day's now-graded attempts/mockTestQuestions, no
// AI call happens here or in that cron step -- see the 2026-07-24
// overnight-batch-grading change). Defaults to yesterday, since "today" has
// no grading run yet by definition of when this route is normally viewed.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { dailyResultsDigests } from "../../../../db/schema.js";
import { getSessionUserId } from "../../../../lib/supabase/server.js";

function yesterdayUtc() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || yesterdayUtc();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date must be in YYYY-MM-DD format" }, { status: 400 });
    }

    const [row] = await db
      .select()
      .from(dailyResultsDigests)
      .where(and(eq(dailyResultsDigests.userId, userId), eq(dailyResultsDigests.date, date)));

    if (!row) return NextResponse.json({ date, itemCount: 0, avgScore: null, bySubtopic: [] });

    return NextResponse.json({ date: row.date, itemCount: row.itemCount, avgScore: row.avgScore, bySubtopic: row.bySubtopic });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
