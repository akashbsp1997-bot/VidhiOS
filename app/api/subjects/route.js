import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db.js";
import { subjects } from "../../../db/schema.js";

// Small lightweight list, currently only consumed by app/ingest/upload/page.jsx's
// subject dropdown. Session-gated like the rest of the app (via middleware.js) --
// unlike /api/ingest/*, this isn't an admin-only operation.
export async function GET() {
  try {
    const rows = await db
      .select({ id: subjects.id, displayName: subjects.displayName })
      .from(subjects)
      .where(eq(subjects.active, true));
    return NextResponse.json({ subjects: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
