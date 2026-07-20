export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { ingestUploads, ingestItems, subtopics } from "../../../../db/schema.js";
import { structureUpload } from "../../../../lib/ingest/structure.js";

// Turns one extracted upload into candidate ingestItems rows -- the one AI
// call per document (see lib/ingest/structure.js). Requires the upload to
// already be status="extracted" (i.e. finalize-upload ran and it wasn't
// flagged needs_ocr/duplicate/error); nothing here is written to a live
// subtopics/pyqs/sources table -- that only happens once the operator
// approves an item in a later PR's review UI.
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
    if (upload.status !== "extracted") {
      return NextResponse.json(
        { error: `Upload status is "${upload.status}", not "extracted" -- ${upload.status === "needs_ocr" ? "this PDF has no usable text layer, OCR isn't supported yet." : upload.status === "duplicate" ? "this is a duplicate of an earlier upload." : "check errorMsg on the upload."}` },
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
      .set({ status: "structured", structuredAt: new Date(), textTruncatedForAi })
      .where(eq(ingestUploads.id, uploadId));

    return NextResponse.json({ status: "structured", itemCount: items.length, textTruncatedForAi });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
