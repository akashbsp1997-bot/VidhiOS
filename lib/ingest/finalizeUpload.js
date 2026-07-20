// lib/ingest/finalizeUpload.js
//
// Shared by app/api/ingest/finalize-upload (browser file upload, already in
// Storage) and app/api/ingest/fetch-url (server-fetched from a public URL,
// not yet in Storage) -- both end up with the same raw PDF bytes and need
// the identical hash/dedupe/extract/insert sequence; this is the one place
// that sequence lives.

import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { ingestUploads } from "../../db/schema.js";
import { hashBuffer, extractPdfText } from "./extractPdf.js";

/**
 * `buf` is the raw PDF bytes, already confirmed present at `storagePath` in
 * the 'ingest-uploads' bucket (finalize-upload) or about to be written
 * there by the caller (fetch-url). `sourceUrl` is set only for the latter.
 * Returns the same shape both routes respond with.
 */
export async function finalizeIngestUpload({ buf, docType, subjectId, storagePath, originalFilename, fileSizeBytes, sourceUrl = null }) {
  const contentHash = hashBuffer(buf);

  const [existing] = await db.select({ id: ingestUploads.id }).from(ingestUploads).where(eq(ingestUploads.contentHash, contentHash));
  if (existing) {
    const [dupRow] = await db
      .insert(ingestUploads)
      .values({
        docType,
        subjectId,
        storagePath,
        originalFilename,
        sourceUrl,
        fileSizeBytes: fileSizeBytes || buf.length,
        contentHash,
        status: "duplicate",
        dupOfUploadId: existing.id,
      })
      .returning();
    return { status: "duplicate", uploadId: dupRow.id, dupOfUploadId: existing.id };
  }

  const { extractedText, extractedCharCount, pageCount, charsPerPage, needsOcr } = await extractPdfText(buf);

  const [row] = await db
    .insert(ingestUploads)
    .values({
      docType,
      subjectId,
      storagePath,
      originalFilename,
      sourceUrl,
      fileSizeBytes: fileSizeBytes || buf.length,
      contentHash,
      pageCount,
      extractedCharCount,
      extractedText,
      status: needsOcr ? "needs_ocr" : "extracted",
      extractedAt: new Date(),
    })
    .returning();

  return {
    status: row.status,
    uploadId: row.id,
    pageCount,
    charsPerPage: Math.round(charsPerPage),
    needsOcr,
    textPreview: extractedText.slice(0, 500),
  };
}
