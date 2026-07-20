// 120s, not the 60s used by the other admin routes here -- this route's one
// AI call per chunk can request up to 8000 tokens (same order of magnitude
// as the lesson-generation call that was previously observed taking ~50s+
// on a free-tier model, see lib/ai/generateLesson.js's history), so it
// needs more headroom before Vercel kills the function mid-request. This
// doesn't grow with chunk count -- each call still does exactly one chunk.
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { ingestUploads, ingestItems, subtopics } from "../../../../db/schema.js";
import { structureUpload, chunkBounds } from "../../../../lib/ingest/structure.js";

// Turns ONE CHUNK of an extracted upload into candidate ingestItems rows --
// one AI call per chunk, not one call for the whole document (see
// lib/ingest/structure.js's chunkBounds). A document longer than its
// docType's textCap needs multiple calls to this route, one per chunk;
// each call processes upload.chunksProcessed (the next not-yet-done chunk)
// and only advances that counter on success, so a failed attempt retries
// the SAME chunk rather than skipping content or losing earlier chunks'
// already-inserted ingestItems.
//
// Requires the upload to be status="extracted" OR "error" -- "error" is
// included deliberately so a transient AI failure (timeout/rate-limit) is
// retryable, not a dead end (found live: several retries after model swaps
// were silently rejected before this allowed "error" through). Nothing
// here is written to a live subtopics/pyqs/sources table -- that only
// happens once the operator approves an item in the review UI.
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

    const { text: chunkText, chunkIndex, totalChunks } = chunkBounds(upload.docType, upload.extractedText, upload.chunksProcessed || 0);

    const existingSubtopics = await db
      .select({ id: subtopics.id, topicText: subtopics.topicText })
      .from(subtopics)
      .where(eq(subtopics.subjectId, upload.subjectId));

    let structured;
    try {
      structured = await structureUpload(upload.docType, chunkText, existingSubtopics);
    } catch (aiErr) {
      await db.update(ingestUploads).set({ status: "error", errorMsg: aiErr.message, totalChunks }).where(eq(ingestUploads.id, uploadId));
      return NextResponse.json({ status: "error", error: aiErr.message, chunkIndex, totalChunks }, { status: 502 });
    }

    const { items, itemType } = structured;
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

    const chunksProcessed = chunkIndex + 1;
    const done = chunksProcessed >= totalChunks;
    await db
      .update(ingestUploads)
      .set({
        status: done ? "structured" : "extracted",
        chunksProcessed,
        totalChunks,
        structuredAt: done ? new Date() : upload.structuredAt,
        errorMsg: null,
      })
      .where(eq(ingestUploads.id, uploadId));

    return NextResponse.json({
      status: done ? "structured" : "extracted",
      itemCount: items.length,
      chunkIndex,
      chunksProcessed,
      totalChunks,
      done,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
