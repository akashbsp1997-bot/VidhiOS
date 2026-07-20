import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { ingestUploads } from "../../../../db/schema.js";

// Lists uploads, most-recent-first, for the /ingest/upload page's status
// list. Optional ?status= filter (e.g. "extracted", to find rows ready for
// the "Structure with AI" step added in a later PR).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=." }, { status: 401 });
  }

  const status = searchParams.get("status");
  try {
    const rows = await db
      .select()
      .from(ingestUploads)
      .where(status ? eq(ingestUploads.status, status) : undefined)
      .orderBy(desc(ingestUploads.createdAt))
      .limit(50);

    return NextResponse.json({
      uploads: rows.map((r) => ({
        id: r.id,
        docType: r.docType,
        subjectId: r.subjectId,
        originalFilename: r.originalFilename,
        sourceUrl: r.sourceUrl,
        status: r.status,
        pageCount: r.pageCount,
        charsPerPage: r.pageCount ? Math.round((r.extractedCharCount || 0) / r.pageCount) : null,
        errorMsg: r.errorMsg,
        dupOfUploadId: r.dupOfUploadId,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
