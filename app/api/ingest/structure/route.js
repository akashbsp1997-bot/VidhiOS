// 120s, not the 60s used by the other admin routes here -- this route's one
// AI call can request up to 3500 tokens (same order of magnitude as the
// lesson-generation call that was previously observed taking ~50s+ on a
// free-tier model, see lib/ai/generateLesson.js's history), so it needs
// more headroom before Vercel kills the function mid-request.
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { ingestUploads, ingestItems, subtopics } from "../../../../db/schema.js";
import { structureUpload } from "../../../../lib/ingest/structure.js";

// Turns one extracted upload into candidate ingestItems rows -- the one AI
// call per document (see lib/ingest/structure.js). Requires the upload to
// be status="extracted" OR "error" -- "error" is included deliberately so a
// transient AI failure (timeout/rate-limit) is retryable from the same
// upload, not a dead end; without this, a single failed attempt would
// permanently block ever calling this again for that upload (found live:
// several retries after model swaps were silently rejected by this exact
// check before it allowed "error" through). Nothing here is written to a
// live subtopics/pyqs/sources table -- that only happens once the operator
// approves an item in the review UI.
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=." }, { status: 401 });
  }

  try {
    const { uploadId } = await request.json();
    if (!uploadId) return NextResponse.json({ error: "uploadId is required" }, { status: 400 });

    const [upload] = await db.select().from(ingestUploads).where(eq(ingestUploads.id, uploadId));
    if (!upload) return NextResponse.json({ error: `Unknown uploadId ${uploadId}` }, { status: 404 });
    if (upload.status !== "extracted" && upload.status !== "error") {
      return NextResponse.json(
        { error: `Upload status is "${upload.status}" -- ${upload.status === "needs_ocr" ? "this PDF has no usable text layer, OCR isn't supported yet." : upload.status === "duplicate" ? "this is a duplicate of an earlier upload." : upload.status === "structured" ? "already structured -- see the review page." : "not ready to structure yet."}` },
        { status: 400 }
      );
    }

    const existingSubtopics = await db
      .select({ id: subtopics.id, topicText: subtopics.topicText })
      .from(subtopics)
      .where(eq(subtopics.subjectId, upload.subjectId));

    let structured;
    try {
      structured = await structureUpload(upload, existingSubtopics);
    } catch (aiErr) {
      await db.update(ingestUploads).set({ status: "error", errorMsg: aiErr.message }).where(eq(ingestUploads.id, uploadId));
      return NextResponse.json({ status: "error", error: aiErr.message }, { status: 502 });
    }

    const { items, itemType, textTruncatedForAi } = structured;
    if (items.length) {
      await db.insert(ingestItems).values(
        items.map((item) => ({
          uploadId,
          itemType,
          suggestedSubtopicId: item.existingSubtopicId ?? item.matchedSubtopicId ?? null,
          suggestedSubtopicIsNew: Boolean(item.isNewSubtopic),
          suggestedData: item,
        }))
      );
    }

    await db
      .update(ingestUploads)
      .set({ status: "structured", structuredAt: new Date(), textTruncatedForAi, errorMsg: null })
      .where(eq(ingestUploads.id, uploadId));

    return NextResponse.json({ status: "structured", itemCount: items.length, textTruncatedForAi });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
