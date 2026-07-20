export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/adminClient.js";
import { isValidDocType } from "../../../../lib/ingest/docTypes.js";
import { finalizeIngestUpload } from "../../../../lib/ingest/finalizeUpload.js";

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
    const result = await finalizeIngestUpload({ buf, docType, subjectId, storagePath, originalFilename, fileSizeBytes });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
