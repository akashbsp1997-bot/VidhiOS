// lib/ingest/docTypes.js
//
// The canonical set of upload doc types, shared between the upload routes
// (validation) and lib/ingest/config.js (per-type AI structuring config,
// added in a later PR) so there's exactly one place either list can drift
// from the other.

export const INGEST_DOC_TYPES = ["syllabus", "pyq_paper", "ncert_chapter", "newspaper_clipping"];

export function isValidDocType(docType) {
  return INGEST_DOC_TYPES.includes(docType);
}
