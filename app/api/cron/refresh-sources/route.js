// app/api/cron/refresh-sources/route.js
//
// Wired to Vercel Cron via vercel.json (weekly by default). Refreshes any
// source that's never been fetched, previously errored, or is older than
// STALE_DAYS — a handful at a time, sequentially, so one slow/broken
// government site can't dominate the run. This does NOT discover new URLs;
// it only refreshes what's already in the `sources` table (see
// docs/ARCHITECTURE.md for why).

import { NextResponse } from "next/server";
import { or, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { sources } from "../../../../db/schema.js";
import { fetchAndExtractText } from "../../../../lib/sources/fetchAndCache.js";

const STALE_DAYS = 30;
const MAX_PER_RUN = 15;

export async function GET(request) {
  // Vercel Cron requests carry this header; reject anything else so the
  // endpoint can't be used to trigger a bulk-fetch run by a random visitor.
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await db
    .select()
    .from(sources)
    .where(or(isNull(sources.fetchedAt), sql`${sources.status} = 'error'`, lt(sources.fetchedAt, staleCutoff)))
    .limit(MAX_PER_RUN);

  const results = [];
  for (const source of candidates) {
    try {
      const { extractedText, fetchedAt } = await fetchAndExtractText(source.url);
      await db
        .update(sources)
        .set({ extractedText, fetchedAt, status: "ok", errorMsg: null })
        .where(sql`${sources.id} = ${source.id}`);
      results.push({ id: source.id, status: "ok" });
    } catch (err) {
      await db
        .update(sources)
        .set({ status: "error", errorMsg: String(err.message).slice(0, 500), fetchedAt: new Date() })
        .where(sql`${sources.id} = ${source.id}`);
      results.push({ id: source.id, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ checked: candidates.length, results });
}
