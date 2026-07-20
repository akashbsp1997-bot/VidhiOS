export const maxDuration = 60;

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../../../lib/db.js";

// Applies pending drizzle-kit migrations (drizzle/*.sql) against the real
// database. This exists because schema changes now ship as versioned
// migration files (see drizzle/, and the Phase 1 plan) instead of the old
// hand-DDL array that used to live in app/api/setup/route.js -- but running
// `npm run db:migrate` requires a local terminal with a real DATABASE_URL,
// which isn't how this project has been developed (GitHub's mobile web
// editor, no local dev environment). This route is the mobile-workflow
// equivalent: hit it once from a browser after a schema PR merges, same
// pattern as /api/setup for seed data.
//
// Safe to re-run: drizzle's migrator tracks applied migrations in a
// drizzle.__drizzle_migrations bookkeeping table and only runs new ones.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Missing or wrong ?key=. Check SETUP_SECRET in your Vercel env vars." }, { status: 401 });
  }

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } catch (err) {
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }

  // Report the new Phase 1 columns' presence so success is verifiable from
  // the HTTP response alone, without needing a separate DB connection.
  try {
    const cols = await db.execute(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'subtopics' and column_name = 'subject_id') or
          (table_name = 'pyqs' and column_name = 'subject_id') or
          (table_name = 'sources' and column_name = 'source_tier') or
          (table_name = 'attempts' and column_name = 'user_id') or
          (table_name = 'mastery' and column_name = 'user_id')
        )
      order by table_name, column_name
    `);
    const subjectsTable = await db.execute(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name = 'subjects'
    `);
    return NextResponse.json({
      status: "ok",
      message: "Migrations applied (or already up to date).",
      subjectsTableExists: subjectsTable.length > 0,
      newColumnsFound: cols.map((r) => `${r.table_name}.${r.column_name}`),
    });
  } catch (err) {
    return NextResponse.json({
      status: "partial",
      message: `Migration ran, but the verification query failed: ${err.message}`,
    });
  }
}
