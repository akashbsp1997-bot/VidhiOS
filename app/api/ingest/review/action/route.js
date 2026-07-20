export const maxDuration = 60;

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../../lib/db.js";
import { ingestItems, ingestUploads } from "../../../../../db/schema.js";
import { commitIngestItem, IngestCommitError } from "../../../../../lib/ingest/commit.js";

// Approve/reject one ingestItem. Reject is a pure status change -- nothing
// live is touched. Approve calls commitIngestItem; on failure the item's
// reviewStatus is deliberately left "pending" (not "rejected") with
// commitError set, so it stays visible in the review queue and can be
// edited and retried, rather than silently disappearing.
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=." }, { status: 401 });
  }

  try {
    const { itemId, action, editedData } = await request.json();
    if (!itemId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: 'itemId and action ("approve"|"reject") are required' }, { status: 400 });
    }

    const [item] = await db.select().from(ingestItems).where(eq(ingestItems.id, itemId));
    if (!item) return NextResponse.json({ error: `Unknown itemId ${itemId}` }, { status: 404 });

    if (action === "reject") {
      await db.update(ingestItems).set({ reviewStatus: "rejected", reviewedAt: new Date() }).where(eq(ingestItems.id, itemId));
      return NextResponse.json({ ok: true });
    }

    // action === "approve"
    const finalData = editedData ?? item.finalData ?? item.suggestedData;
    if (editedData) {
      await db.update(ingestItems).set({ finalData }).where(eq(ingestItems.id, itemId));
    }

    const [upload] = await db.select().from(ingestUploads).where(eq(ingestUploads.id, item.uploadId));
    if (!upload) return NextResponse.json({ error: `Parent upload ${item.uploadId} not found` }, { status: 500 });

    try {
      const result = await commitIngestItem(db, { ...item, finalData }, upload);
      await db
        .update(ingestItems)
        .set({
          reviewStatus: "approved",
          committedTable: result.committedTable,
          committedId: result.committedId,
          commitError: null,
          reviewedAt: new Date(),
        })
        .where(eq(ingestItems.id, itemId));
      return NextResponse.json({ ok: true, committedTable: result.committedTable, committedId: result.committedId, warning: result.warning });
    } catch (commitErr) {
      const message = commitErr instanceof IngestCommitError ? commitErr.message : `Commit failed: ${commitErr.message}`;
      await db.update(ingestItems).set({ commitError: message }).where(eq(ingestItems.id, itemId));
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
