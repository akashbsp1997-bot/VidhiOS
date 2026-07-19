// scripts/seed.js
//
// Run once after `npx drizzle-kit push` has created the tables:
//   npm run seed
//
// Inserts the 81-topic syllabus, 168 real PYQs, and the starter batch of
// verified official sources. Safe to re-run:
//  - subtopics upsert on id
//  - pyqs insert-if-missing on id
//  - sources insert-if-missing on (subtopicId, url) since its id is a serial

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { subtopics, pyqs, sources } from "../db/schema.js";
import { syllabusSeed } from "../db/seed/syllabus.js";
import { pyqsSeed } from "../db/seed/pyqs.js";
import { sourcesSeed } from "../db/seed/sources.js";

async function main() {
  console.log(`Seeding ${syllabusSeed.length} subtopics...`);
  for (const row of syllabusSeed) {
    await db
      .insert(subtopics)
      .values(row)
      .onConflictDoUpdate({ target: subtopics.id, set: { pyqFrequency: row.pyqFrequency } });
  }

  console.log(`Seeding ${pyqsSeed.length} PYQs...`);
  for (const row of pyqsSeed) {
    await db.insert(pyqs).values(row).onConflictDoNothing({ target: pyqs.id });
  }

  console.log(`Seeding ${sourcesSeed.length} starter sources...`);
  let sourcesInserted = 0;
  for (const row of sourcesSeed) {
    const existing = await db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.subtopicId, row.subtopicId), eq(sources.url, row.url)));
    if (existing.length === 0) {
      await db.insert(sources).values(row);
      sourcesInserted++;
    }
  }
  console.log(`  -> ${sourcesInserted} new source rows inserted (rest already present).`);

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
