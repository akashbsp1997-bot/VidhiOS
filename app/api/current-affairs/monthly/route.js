// app/api/current-affairs/monthly/route.js
//
// GET ?month=YYYY-MM (defaults to the current month) -> a theme-grouped
// overview of that month's current-affairs items, generating it once (one
// AI call, see lib/ai/monthlyDigest.js) on first request and reusing the
// cached row after -- same "generate once, cache forever" pattern as
// essay-guide. A month with fewer than MIN_ITEMS_FOR_DIGEST stored items
// (e.g. the current month, still in progress, or a month before the
// current-affairs feature was ever configured) returns itemCount:0 rather
// than forcing a thin/useless digest out of almost no real input.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { currentAffairsItems, monthlyDigests } from "../../../../db/schema.js";
import { getSessionUserId } from "../../../../lib/supabase/server.js";
import { generateMonthlyDigest } from "../../../../lib/ai/monthlyDigest.js";

const MIN_ITEMS_FOR_DIGEST = 5;

function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextMonth = new Date(Date.UTC(y, m, 1)); // m is 1-based here, so this is the 1st of the NEXT month
  const end = nextMonth.toISOString().slice(0, 10);
  return { start, end };
}

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
    }

    const [existing] = await db.select().from(monthlyDigests).where(eq(monthlyDigests.month, month));
    if (existing) {
      return NextResponse.json({ month, overview: existing.overview, themes: existing.themes, itemCount: existing.itemCount, cached: true });
    }

    const { start, end } = monthBounds(month);
    const items = await db
      .select({ publishedDate: currentAffairsItems.publishedDate, title: currentAffairsItems.title, summary: currentAffairsItems.summary })
      .from(currentAffairsItems)
      .where(and(gte(currentAffairsItems.publishedDate, start), lt(currentAffairsItems.publishedDate, end)));

    if (items.length < MIN_ITEMS_FOR_DIGEST) {
      return NextResponse.json({ month, overview: null, themes: [], itemCount: items.length, cached: false });
    }

    const digest = await generateMonthlyDigest({ month, items });
    const [saved] = await db
      .insert(monthlyDigests)
      .values({ month, overview: digest.overview, themes: digest.themes, itemCount: items.length })
      .onConflictDoNothing({ target: monthlyDigests.month })
      .returning();

    // onConflictDoNothing returns [] if a concurrent request won the race.
    const row = saved ?? (await db.select().from(monthlyDigests).where(eq(monthlyDigests.month, month)))[0];
    return NextResponse.json({ month, overview: row.overview, themes: row.themes, itemCount: row.itemCount, cached: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
