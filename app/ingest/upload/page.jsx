"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client.js";

const DOC_TYPES = [
  { value: "syllabus", label: "Syllabus" },
  { value: "pyq_paper", label: "PYQ paper" },
  { value: "ncert_chapter", label: "NCERT chapter" },
  { value: "newspaper_clipping", label: "Newspaper / current-affairs clipping" },
];

const STATUS_COLOR = {
  uploaded: "var(--ink-soft)",
  extracted: "var(--forest)",
  needs_ocr: "var(--maroon)",
  duplicate: "var(--ink-soft)",
  error: "var(--maroon)",
  structured: "var(--forest)",
};

// Admin-only upload page for the Phase 2 content-ingestion pipeline (see
// docs/ARCHITECTURE.md) -- reads ?key= from its own URL the same way
// app/login/page.jsx reads ?next=, and appends it to every /api/ingest/*
// call. Bookmarkable: visit /ingest/upload?key=YOUR_SETUP_SECRET once. Sits
// behind the normal Supabase-login gate (middleware.js) like the rest of
// the app; only the underlying API calls are SETUP_SECRET-gated.
export default function IngestUploadPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key") || "";

  const [docType, setDocType] = useState("syllabus");
  const [subjectId, setSubjectId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [file, setFile] = useState(null);
  const [stepMsg, setStepMsg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(null);
  const [uploadsError, setUploadsError] = useState(null);

  useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json())
      .then((d) => {
        if (d.subjects) {
          setSubjects(d.subjects);
          if (d.subjects.length && !subjectId) setSubjectId(d.subjects[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [structuringId, setStructuringId] = useState(null);
  const [structureResult, setStructureResult] = useState({}); // uploadId -> { itemCount, textTruncatedForAi } | { error }

  function loadUploads() {
    fetch(`/api/ingest/uploads?key=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setUploadsError(d.error) : setUploads(d.uploads)))
      .catch((e) => setUploadsError(e.message));
  }

  useEffect(() => {
    if (key) loadUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function structureNow(uploadId) {
    setStructuringId(uploadId);
    setStructureResult((prev) => ({ ...prev, [uploadId]: undefined }));
    try {
      const res = await fetch(`/api/ingest/structure?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      const data = await res.json();
      setStructureResult((prev) => ({ ...prev, [uploadId]: data.error ? { error: data.error } : data }));
      loadUploads();
    } catch (err) {
      setStructureResult((prev) => ({ ...prev, [uploadId]: { error: err.message } }));
    } finally {
      setStructuringId(null);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !subjectId) return;
    setError(null);
    setBusy(true);
    try {
      setStepMsg("Requesting upload URL…");
      const urlRes = await fetch(`/api/ingest/upload-url?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docType, subjectId, filename: file.name }),
      });
      const urlData = await urlRes.json();
      if (urlData.error) throw new Error(urlData.error);

      setStepMsg("Uploading PDF…");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("ingest-uploads")
        .uploadToSignedUrl(urlData.storagePath, urlData.token, file);
      if (uploadError) throw new Error(uploadError.message);

      setStepMsg("Extracting text…");
      const finalizeRes = await fetch(`/api/ingest/finalize-upload?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          docType,
          subjectId,
          storagePath: urlData.storagePath,
          originalFilename: file.name,
          fileSizeBytes: file.size,
        }),
      });
      const finalizeData = await finalizeRes.json();
      if (finalizeData.error) throw new Error(finalizeData.error);

      setStepMsg(
        finalizeData.status === "duplicate"
          ? "Already uploaded before — this is an exact duplicate of an earlier upload."
          : finalizeData.status === "needs_ocr"
          ? `Extracted ~${finalizeData.charsPerPage} chars/page — too low to be a real text layer. This looks like a scanned/image PDF; OCR isn't supported yet.`
          : `Extracted ${finalizeData.charsPerPage} chars/page across ${finalizeData.pageCount} page(s).`
      );
      setFile(null);
      loadUploads();
    } catch (err) {
      setError(err.message);
      setStepMsg(null);
    } finally {
      setBusy(false);
    }
  }

  if (!key) {
    return (
      <div className="card">
        <h1>Upload content</h1>
        <div className="error-box">
          Missing <code>?key=</code>. Visit this page as <code>/ingest/upload?key=YOUR_SETUP_SECRET</code>.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1>Upload content</h1>
          <a href={`/ingest/review?key=${encodeURIComponent(key)}`} style={{ fontSize: 13.5 }}>
            Review pending →
          </a>
        </div>
        <p className="lede">Syllabus, PYQ papers, NCERT chapters, or newspaper clippings — text-layer PDFs only for now.</p>

        {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

        <form onSubmit={handleUpload}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4, color: "var(--ink-soft)" }}>Document type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid var(--rule)" }}
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label style={{ display: "block", fontSize: 13, marginBottom: 4, color: "var(--ink-soft)" }}>Subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid var(--rule)" }}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>

          <label style={{ display: "block", fontSize: 13, marginBottom: 4, color: "var(--ink-soft)" }}>PDF file</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ width: "100%", marginBottom: 14 }}
          />

          <button className="btn btn-primary" type="submit" disabled={busy || !file || !subjectId} style={{ width: "100%" }}>
            {busy ? "Working…" : "Upload"}
          </button>
        </form>

        {stepMsg && <div className="disclaimer" style={{ marginTop: 14 }}>{stepMsg}</div>}
      </div>

      <div className="card">
        <h2>Recent uploads</h2>
        {uploadsError && <div className="error-box">{uploadsError}</div>}
        {!uploads && !uploadsError && <div className="loading">Loading…</div>}
        {uploads && uploads.length === 0 && (
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>No uploads yet.</p>
        )}
        {uploads &&
          uploads.map((u) => (
            <div className="source-row" key={u.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span>{u.originalFilename}</span>
                <span className="source-status" style={{ color: STATUS_COLOR[u.status] || "var(--ink-soft)" }}>
                  {u.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 3 }}>
                {u.docType} · {u.subjectId}
                {u.charsPerPage != null ? ` · ${u.charsPerPage} chars/page` : ""}
                {u.pageCount ? ` · ${u.pageCount} page(s)` : ""}
              </div>
              {u.errorMsg && <div style={{ fontSize: 12, color: "var(--maroon)", marginTop: 3 }}>{u.errorMsg}</div>}
              {u.status === "needs_ocr" && (
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 3 }}>
                  Scanned/image PDF — text extraction too low to process. OCR isn't supported yet.
                </div>
              )}
              {u.status === "extracted" && (
                <button
                  className="btn"
                  style={{ marginTop: 8, padding: "6px 12px", fontSize: 13 }}
                  onClick={() => structureNow(u.id)}
                  disabled={structuringId === u.id}
                >
                  {structuringId === u.id ? "Structuring…" : "Structure with AI"}
                </button>
              )}
              {structureResult[u.id] &&
                (structureResult[u.id].error ? (
                  <div style={{ fontSize: 12, color: "var(--maroon)", marginTop: 6 }}>{structureResult[u.id].error}</div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--forest)", marginTop: 6 }}>
                    {structureResult[u.id].itemCount} candidate item(s) ready for review.
                    {structureResult[u.id].textTruncatedForAi ? " (Document was long — only the first part was sent to the AI.)" : ""}
                  </div>
                ))}
              {u.status === "structured" && !structureResult[u.id] && (
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>
                  Already structured —{" "}
                  <a href={`/ingest/review?key=${encodeURIComponent(key)}`}>review candidates</a>.
                </div>
              )}
            </div>
          ))}
      </div>
    </>
  );
}
