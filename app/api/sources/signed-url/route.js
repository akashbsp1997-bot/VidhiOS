import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { sources, ingestUploads } from "../../../../db/schema.js";
import { createAdminClient } from "../../../../lib/supabase/adminClient.js";
import { getSessionUserId } from "../../../../lib/supabase/server.js";

const BUCKET = "ingest-uploads";
const EXPIRES_IN_SECONDS = 60 * 60; // 1 hour -- minted fresh on each request, never persisted

// Resolves a sources row whose url is the "storage://ingest-uploads/<path>"
// sentinel (see lib/ingest/storageUrl.js) into a real, temporary signed URL
// the browser can actually open. The bucket is private, so this has to go
// through the service-role admin client server-side -- session-gated like
// the rest of the study-facing app (not SETUP_SECRET), since any signed-in
// user browsing sources should be able to open one, same as any other
// source link.
export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");
  if (!sourceId) return NextResponse.json({ error: "sourceId is required" }, { status: 400 });

  try {
    const [source] = await db.select().from(sources).where(eq(sources.id, Number(sourceId)));
    if (!source) return NextResponse.json({ error: "Unknown source" }, { status: 404 });
    if (!source.storageUploadId) {
      return NextResponse.json({ error: "This source isn't backed by an uploaded file." }, { status: 400 });
    }

    const [upload] = await db.select({ storagePath: ingestUploads.storagePath }).from(ingestUploads).where(eq(ingestUploads.id, source.storageUploadId));
    if (!upload) return NextResponse.json({ error: "The backing upload record is missing." }, { status: 404 });

    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(upload.storagePath, EXPIRES_IN_SECONDS);
    if (error) throw error;

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
