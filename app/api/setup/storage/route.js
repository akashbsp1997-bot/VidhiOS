export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/adminClient.js";

const BUCKET = "ingest-uploads";

// One-time (but safe to re-run) Storage setup for the Phase 2 ingestion
// pipeline: creates the private bucket uploaded PDFs live in permanently.
// Nested under /api/setup/ so it's covered by middleware.js's existing
// PUBLIC_API_PREFIXES entry for "/api/setup" -- no middleware change needed
// for this route specifically (app/api/ingest/* routes added in later PRs
// do need one, since they don't share that path prefix).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=. Check SETUP_SECRET in your Vercel env vars." }, { status: 401 });
  }

  const log = [];
  let hadError = false;

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "50MB",
      allowedMimeTypes: ["application/pdf"],
    });
    if (error) {
      // Supabase returns this specific message when the bucket is already
      // there -- idempotent re-runs should report OK, not FAIL.
      if (/already exists/i.test(error.message)) {
        log.push(`OK  bucket:${BUCKET} (already exists)`);
      } else {
        throw error;
      }
    } else {
      log.push(`OK  bucket:${BUCKET} (created)`);
    }
  } catch (err) {
    hadError = true;
    log.push(`FAIL bucket:${BUCKET} -- ${err.message}`);
  }

  return NextResponse.json(
    {
      status: hadError ? "partial" : "ok",
      log,
      next: hadError
        ? "Bucket creation failed -- check SUPABASE_SERVICE_ROLE_KEY is set correctly in Vercel env vars, then re-run this URL."
        : "Storage bucket ready. Next: run /api/migrate?key=... to apply the ingest_uploads/ingest_items schema, then use /ingest/upload.",
    },
    { status: hadError ? 207 : 200 }
  );
}
