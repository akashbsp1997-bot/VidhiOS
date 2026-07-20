export const maxDuration = 60;

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "../../../../lib/supabase/adminClient.js";
import { isValidDocType } from "../../../../lib/ingest/docTypes.js";
import { finalizeIngestUpload } from "../../../../lib/ingest/finalizeUpload.js";
import { USER_AGENT, looksLikePdf } from "../../../../lib/sources/fetchAndCache.js";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { subjects } from "../../../../db/schema.js";

const BUCKET = "ingest-uploads";

// Alternative to the upload-url/finalize-upload pair, for content that's
// already publicly hosted (e.g. an NCERT textbook PDF on ncert.nic.in) --
// no reason to make the operator download it and re-upload it by hand.
// Fetches the PDF server-side, archives it into the same private Storage
// bucket as a browser upload would (so it's still backed up even if the
// source URL later goes away), and records the origin `sourceUrl` on the
// ingestUploads row so the operator can click through and verify a
// candidate against the real source during review -- the whole reason this
// route exists rather than just fetching-and-discarding.
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=." }, { status: 401 });
  }

  try {
    const { docType, subjectId, url } = await request.json();
    if (!isValidDocType(docType) || !subjectId || !url) {
      return NextResponse.json({ error: "docType, subjectId, url are required" }, { status: 400 });
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("not http(s)");
    } catch {
      return NextResponse.json({ error: `"${url}" is not a valid http(s) URL.` }, { status: 400 });
    }
    const [subject] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectId));
    if (!subject) return NextResponse.json({ error: `Unknown subjectId "${subjectId}"` }, { status: 400 });

    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    } catch (err) {
      return NextResponse.json({ error: `Could not reach "${url}": ${err.message}` }, { status: 400 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Fetching "${url}" returned ${res.status} ${res.statusText}` }, { status: 400 });
    }
    const contentType = res.headers.get("content-type") || "";
    if (!looksLikePdf(url, contentType)) {
      return NextResponse.json(
        { error: `"${url}" doesn't look like a PDF (content-type: "${contentType}") -- this pipeline only handles PDFs for now.` },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());

    const originalFilename = decodeURIComponent(parsedUrl.pathname.split("/").pop() || "document.pdf");
    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const storagePath = `${docType}/${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`;

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, buf, { contentType: "application/pdf" });
    if (uploadError) throw uploadError;

    const result = await finalizeIngestUpload({
      buf,
      docType,
      subjectId,
      storagePath,
      originalFilename,
      fileSizeBytes: buf.length,
      sourceUrl: url,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
