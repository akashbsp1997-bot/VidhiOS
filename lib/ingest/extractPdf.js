// lib/ingest/extractPdf.js
//
// Text-layer PDF extraction for uploaded documents, reusing the exact
// pdf-parse usage and cleanup helper already proven in
// lib/sources/fetchAndCache.js's fetchAndExtractText -- this module only
// differs in taking an in-memory buffer (the upload's already-downloaded
// bytes) instead of fetching a URL, and in NOT capping the result (uploaded
// documents can be much longer than a grounding excerpt; per-docType
// truncation happens later, at AI-structuring time, not at extraction time).

import crypto from "node:crypto";
import { cleanAndTruncate } from "../sources/fetchAndCache.js";

// Page-averaged chars/page below this is treated as "no real text layer" --
// i.e. a scanned/photographed PDF, which this pipeline explicitly does not
// attempt to OCR (see the Phase 2 plan). A real digitally-produced PDF page
// of body text runs well into the hundreds/thousands of characters; a
// scanned page pdf-parse can't read typically yields ~0.
export const NEEDS_OCR_CHARS_PER_PAGE = 100;

export function hashBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Extracts and cleans text from a PDF buffer. Does not throw on a
 * low-text/scanned PDF -- that's a normal, expected outcome the caller
 * checks via `needsOcr`, not an error.
 */
export async function extractPdfText(buf) {
  const { default: pdfParse } = await import("pdf-parse");
  const parsed = await pdfParse(buf);
  const extractedText = cleanAndTruncate(parsed.text, Number.MAX_SAFE_INTEGER);
  const extractedCharCount = extractedText.replace(/\s+/g, "").length;
  const pageCount = parsed.numpages || 1;
  const charsPerPage = extractedCharCount / Math.max(pageCount, 1);
  return {
    extractedText,
    extractedCharCount,
    pageCount,
    charsPerPage,
    needsOcr: charsPerPage < NEEDS_OCR_CHARS_PER_PAGE,
  };
}
