// lib/db/compressedText.js
//
// A transparent gzip codec for large-text columns, as a Drizzle customType
// storing bytea instead of text. Every existing .select()/.insert()/.update()
// call site across the app keeps working unchanged -- Drizzle calls
// toDriver() on write and fromDriver() on read, so app code never sees
// compressed bytes, only the plain string it always dealt with. This is a
// storage-size optimization for content this app is ALREADY allowed to cache
// in full (see lib/sources/tiers.js's isFetchableTier -- NCERT/official
// sources and user-uploaded ingest PDFs), not a way to cache more than
// before: compressing a byte string doesn't change what's legal to store,
// only how many bytes it takes.
//
// fromDriver sniffs the gzip magic bytes (0x1f 0x8b) before attempting to
// decompress, so rows written before this column type existed (plain UTF-8
// bytes, no migration/backfill needed) still read back correctly -- same
// graceful-fallback discipline as components/ModuleLearnFlow.jsx's
// bulletLines() handling pre-existing paragraph content.

import { customType } from "drizzle-orm/pg-core";
import { gzipSync, gunzipSync } from "node:zlib";

const GZIP_MAGIC = [0x1f, 0x8b];

export const compressedText = customType({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return gzipSync(Buffer.from(value ?? "", "utf8"));
  },
  fromDriver(value) {
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const isGzipped = buf.length >= 2 && buf[0] === GZIP_MAGIC[0] && buf[1] === GZIP_MAGIC[1];
    return isGzipped ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  },
});
