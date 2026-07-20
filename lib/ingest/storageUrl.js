// lib/ingest/storageUrl.js
//
// sources.url is NOT NULL, but a row created from an ingested upload has no
// real URL -- only a Storage path. This sentinel format is documented
// directly on db/schema.js's `sources.url` column comment; this module is
// the single place that constructs/parses it, so lib/ingest/commit.js and
// app/api/sources/signed-url/route.js (and app/sources/[subtopicId]/page.jsx,
// client-side) never duplicate the prefix string.

const PREFIX = "storage://ingest-uploads/";

export function toStorageSentinel(storagePath) {
  return `${PREFIX}${storagePath}`;
}

export function isStorageSentinel(url) {
  return typeof url === "string" && url.startsWith(PREFIX);
}

export function storagePathFromSentinel(url) {
  return url.slice(PREFIX.length);
}
