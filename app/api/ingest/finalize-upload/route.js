export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { ingestUploads } from "../../../../db/schema.js";
import { createAdminClient } from "../../../../lib/supabase/adminClient.js";
import { isValidDocType } from "../../../../lib/ingest/docTypes.js";
import { hashBuffer, extractPdfText } from "../../../../lib/ingest/extractPdf.js";

const BUCKET = "ingest-uploads";

// Step 3 of the upload flow: called after the browser has already PUT the
// raw bytes straight to Supabase Storage using the signed URL from
// /api/ingest/upload-url. Downloads the object back (needed regardless, for
// hashing), computes a content hash for exact-duplicate detection, and --
// for new, non-duplicate uploads -- runs pdf-parse extraction and the
// needs_ocr heuristic. This is the first point a DB row for the upload
// exists, so there's never a row pointing at an object that isn't really
// there.
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=." }, { status: 401 });
  }

  try {
    const { docType, subjectId, storagePath, originalFilename, fileSizeBytes } = await request.json();
    if (!isValidDocType(docType) || !subjectId || !storagePath || !originalFilename) {
      return NextResponse.json({ error: "docType, subjectId, storagePath, originalFilename are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: fileBlob, error: downloadError } = await admin.storage.from(BUCKET).download(storagePath);
    if (downloadError) {
      return NextResponse.json(
        { error: `Could not find the uploaded object at "${storagePath}" -- upload may not have completed: ${downloadError.message}` },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await fileBlob.arrayBuffer());
    const contentHash = hashBuffer(buf);

    const [existing] = await db.select({ id: ingestUploads.id }).from(ingestUploads).where(eq(ingestUploads.contentHash, contentHash));
    if (existing) {
      const [dupRow] = await db
        .insert(ingestUploads)
        .values({
          docType,
          subjectId,
          storagePath,
          originalFilename,
          fileSizeBytes: fileSizeBytes || buf.length,
          contentHash,
          status: "duplicate",
          dupOfUploadId: existing.id,
        })
        .returning();
      return NextResponse.json({ status: "duplicate", uploadId: dupRow.id, dupOfUploadId: existing.id });
    }

    const { extractedText, extractedCharCount, pageCount, charsPerPage, needsOcr } = await extractPdfText(buf);

    const [row] = await db
      .insert(ingestUploads)
      .values({
        docType,
        subjectId,
        storagePath,
        originalFilename,
        fileSizeBytes: fileSizeBytes || buf.length,
        contentHash,
        pageCount,
        extractedCharCount,
        extractedText,
        status: needsOcr ? "needs_ocr" : "extracted",
        extractedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      status: row.status,
      uploadId: row.id,
      pageCount,
      charsPerPage: Math.round(charsPerPage),
      needsOcr,
      textPreview: extractedText.slice(0, 500),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
