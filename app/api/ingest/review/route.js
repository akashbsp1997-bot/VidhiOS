import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { ingestItems, ingestUploads } from "../../../../db/schema.js";

// Lists pending review items, either scoped to one upload (?uploadId=) or
// the global pending queue across all uploads. Each item carries a small
// `upload` summary so the review page can show context without a second
// round-trip.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=." }, { status: 401 });
  }

  const uploadId = searchParams.get("uploadId");
  try {
    const whereClause = uploadId
      ? and(eq(ingestItems.reviewStatus, "pending"), eq(ingestItems.uploadId, Number(uploadId)))
      : eq(ingestItems.reviewStatus, "pending");

    const rows = await db
      .select({
        id: ingestItems.id,
        itemType: ingestItems.itemType,
        suggestedSubtopicId: ingestItems.suggestedSubtopicId,
        suggestedSubtopicIsNew: ingestItems.suggestedSubtopicIsNew,
        suggestedData: ingestItems.suggestedData,
        finalData: ingestItems.finalData,
        reviewStatus: ingestItems.reviewStatus,
        commitError: ingestItems.commitError,
        uploadId: ingestUploads.id,
        docType: ingestUploads.docType,
        subjectId: ingestUploads.subjectId,
        originalFilename: ingestUploads.originalFilename,
      })
      .from(ingestItems)
      .innerJoin(ingestUploads, eq(ingestItems.uploadId, ingestUploads.id))
      .where(whereClause)
      .orderBy(ingestItems.createdAt);

    const items = rows.map((r) => ({
      id: r.id,
      itemType: r.itemType,
      suggestedSubtopicId: r.suggestedSubtopicId,
      suggestedSubtopicIsNew: r.suggestedSubtopicIsNew,
      suggestedData: r.suggestedData,
      finalData: r.finalData,
      reviewStatus: r.reviewStatus,
      commitError: r.commitError,
      upload: { id: r.uploadId, docType: r.docType, subjectId: r.subjectId, originalFilename: r.originalFilename },
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
