"use client";

import { useEffect, useState, use } from "react";
import { isStorageSentinel } from "../../../lib/ingest/storageUrl.js";

// Written for Next.js 15+, where route `params` is a Promise even in client
// components and gets unwrapped with React's `use()`. If your Next.js
// version predates that (params is a plain object), replace `use(params)`
// below with just `params`.
export default function SourcesPage({ params }) {
  const { subtopicId } = use(params);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [fetchingId, setFetchingId] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  function load() {
    fetch(`/api/sources?subtopicId=${encodeURIComponent(subtopicId)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtopicId]);

  function refreshSource(sourceId) {
    setFetchingId(sourceId);
    fetch("/api/sources/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId }),
    })
      .then(() => load())
      .finally(() => setFetchingId(null));
  }

  // Ingest-derived sources carry a "storage://ingest-uploads/<path>" sentinel
  // instead of a real URL (the original PDF lives in a private Storage
  // bucket) -- resolve a fresh signed URL on click rather than rendering it
  // as a normal href, which would be a dead link.
  async function openStorageSource(sourceId) {
    setOpeningId(sourceId);
    try {
      const res = await fetch(`/api/sources/signed-url?sourceId=${sourceId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.open(data.url, "_blank", "noreferrer");
    } catch (err) {
      alert(`Could not open this file: ${err.message}`);
    } finally {
      setOpeningId(null);
    }
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="loading">Loading sources\u2026</div>;

  return (
    <>
      <h1>{data.subtopic.id}</h1>
      <p className="lede">{data.subtopic.topicText}</p>

      <div className="card">
        <h2>Official sources</h2>
        {data.sources.length === 0 && (
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
            No sources registered yet for this subtopic. Add rows to the <code>sources</code> table (see
            db/seed/sources.js for the pattern) \u2014 the fetch pipeline will cache whatever URL you point it at.
          </p>
        )}
        {data.sources.map((s) => (
          <div className="source-row" key={s.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              {isStorageSentinel(s.url) ? (
                <button
                  className="btn"
                  style={{ padding: "4px 10px", fontSize: 13.5, border: "none", background: "none", color: "var(--ink)", textDecoration: "underline", cursor: "pointer" }}
                  onClick={() => openStorageSource(s.id)}
                  disabled={openingId === s.id}
                >
                  {openingId === s.id ? "Opening…" : s.title}
                </button>
              ) : (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              )}
              <span className={`source-status ${s.status}`}>{s.status}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 3 }}>
              {s.sourceType} \u00b7 {s.official ? "official" : "reference"}
              {s.fetchedAt ? ` \u00b7 cached ${new Date(s.fetchedAt).toLocaleDateString()}` : " \u00b7 not fetched yet"}
            </div>
            {s.errorMsg && <div style={{ fontSize: 12, color: "var(--maroon)", marginTop: 3 }}>{s.errorMsg}</div>}
            <button
              className="btn"
              style={{ marginTop: 8, padding: "6px 12px", fontSize: 13 }}
              onClick={() => refreshSource(s.id)}
              disabled={fetchingId === s.id}
            >
              {fetchingId === s.id ? "Fetching\u2026" : s.fetchedAt ? "Refresh" : "Fetch now"}
            </button>
            {s.extractedText && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--brass)" }}>Cached text preview</summary>
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6 }}>
                  {s.extractedText.slice(0, 600)}
                  {s.extractedText.length > 600 ? "\u2026" : ""}
                </p>
              </details>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
