// app/api/sources/fetch/route.js
// POST { sourceId } -> fetches that source's URL now, caches extracted text.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { sources } from "../../../../db/schema.js";
import { fetchAndExtractText } from "../../../../lib/sources/fetchAndCache.js";
import { isFetchableTier, maxCharsForTier } from "../../../../lib/sources/tiers.js";

export async function POST(request) {
  try {
    const { sourceId } = await request.json();
    if (!sourceId) return NextResponse.json({ error: "sourceId is required" }, { status: 400 });

    const rows = await db.select().from(sources).where(eq(sources.id, sourceId));
    const source = rows[0];
    if (!source) return NextResponse.json({ error: "Unknown source" }, { status: 404 });

    if (!isFetchableTier(source.sourceTier)) {
      return NextResponse.json(
        { error: "This is a private_vendor tier source -- full-text fetching is intentionally disabled for licensing reasons. Only the title/URL are stored." },
        { status: 400 }
      );
    }

    try {
      const { extractedText, fetchedAt } = await fetchAndExtractText(source.url, { maxChars: maxCharsForTier(source.sourceTier) });
      await db
        .update(sources)
        .set({ extractedText, fetchedAt, status: "ok", errorMsg: null })
        .where(eq(sources.id, sourceId));
      return NextResponse.json({ status: "ok", chars: extractedText.length });
    } catch (fetchErr) {
      await db
        .update(sources)
        .set({ status: "error", errorMsg: String(fetchErr.message).slice(0, 500), fetchedAt: new Date() })
        .where(eq(sources.id, sourceId));
      return NextResponse.json({ status: "error", error: fetchErr.message }, { status: 502 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
