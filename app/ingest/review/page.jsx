"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Editable field lists per itemType -- drives both the input rendered and
// how its value is parsed back out of the (string) input. Matches the exact
// shapes lib/ingest/config.js's prompts ask the AI for and lib/ingest/commit.js
// expects on approve.
const FIELD_SETS = {
  subtopic: [
    { key: "existingSubtopicId", label: "Existing subtopic id (leave blank if new)", type: "text" },
    { key: "suggestedId", label: "New subtopic id (if no existing match)", type: "text" },
    { key: "paper", label: "Paper", type: "number" },
    { key: "section", label: "Section", type: "text" },
    { key: "topicText", label: "Topic text", type: "textarea" },
  ],
  pyq: [
    { key: "suggestedId", label: "PYQ id", type: "text" },
    { key: "year", label: "Year", type: "number" },
    { key: "paper", label: "Paper", type: "number" },
    { key: "slot", label: "Question #", type: "number" },
    { key: "sec", label: "Section (A/B)", type: "text" },
    { key: "sub", label: "Sub-part (a-e)", type: "text" },
    { key: "marks", label: "Marks", type: "number" },
    { key: "questionText", label: "Question text", type: "textarea" },
    { key: "matchedTopics", label: "Matched subtopic ids (comma-separated)", type: "list" },
    { key: "newTopicSuggestion", label: "New topic suggestion (if unmatched)", type: "text" },
  ],
  source: [
    { key: "matchedSubtopicId", label: "Matched subtopic id (must already exist)", type: "text" },
    { key: "newSubtopicSuggestion", label: "New subtopic suggestion (not auto-created)", type: "text" },
    { key: "title", label: "Title", type: "text" },
    { key: "sourceType", label: "Source type", type: "text" },
    { key: "excerptText", label: "Excerpt text", type: "textarea" },
  ],
};

function parseFieldValue(type, raw) {
  if (type === "number") return raw === "" ? null : Number(raw);
  if (type === "list") return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return raw === "" ? null : raw;
}

function fieldDisplayValue(type, value) {
  if (value === null || value === undefined) return "";
  if (type === "list") return Array.isArray(value) ? value.join(", ") : "";
  return String(value);
}

export default function IngestReviewPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key") || "";

  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({}); // itemId -> partial data overrides
  const [busyId, setBusyId] = useState(null);
  const [actionErrors, setActionErrors] = useState({}); // itemId -> message

  function load() {
    fetch(`/api/ingest/review?key=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setItems(d.items)))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (key) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function currentData(item) {
    return { ...(item.finalData || item.suggestedData), ...(edits[item.id] || {}) };
  }

  function setField(itemId, key2, type, raw) {
    setEdits((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [key2]: parseFieldValue(type, raw) } }));
  }

  async function act(item, action) {
    setBusyId(item.id);
    setActionErrors((prev) => ({ ...prev, [item.id]: undefined }));
    const hasEdits = edits[item.id] && Object.keys(edits[item.id]).length > 0;
    try {
      const res = await fetch(`/api/ingest/review/action?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, action, editedData: hasEdits ? currentData(item) : undefined }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setActionErrors((prev) => ({ ...prev, [item.id]: data.error || "Failed" }));
      } else {
        load();
      }
    } catch (err) {
      setActionErrors((prev) => ({ ...prev, [item.id]: err.message }));
    } finally {
      setBusyId(null);
    }
  }

  if (!key) {
    return (
      <div className="card">
        <h1>Review content</h1>
        <div className="error-box">
          Missing <code>?key=</code>. Visit this page as <code>/ingest/review?key=YOUR_SETUP_SECRET</code>.
        </div>
      </div>
    );
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!items) return <div className="loading">Loading…</div>;

  return (
    <div className="card">
      <h1>Review content</h1>
      <p className="lede">Edit anything that's wrong, then approve or reject. Nothing here is live until you approve it.</p>

      {items.length === 0 && <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>Nothing pending review.</p>}

      {items.map((item) => {
        const data = currentData(item);
        const fields = FIELD_SETS[item.itemType] || [];
        return (
          <div className="card" key={item.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span className="meta-line" style={{ marginBottom: 0 }}>
                {item.itemType} · {item.upload.originalFilename} · {item.upload.subjectId}
              </span>
              <span className="source-status" style={{ color: data.confidence === "high" ? "var(--forest)" : data.confidence === "low" ? "var(--maroon)" : "var(--ink-soft)" }}>
                {data.confidence || "—"} confidence
              </span>
            </div>

            {fields.map((f) => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 12.5, marginBottom: 3, color: "var(--ink-soft)" }}>{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea
                    value={fieldDisplayValue(f.type, data[f.key])}
                    onChange={(e) => setField(item.id, f.key, f.type, e.target.value)}
                    rows={f.key === "excerptText" ? 6 : 3}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--rule)", fontFamily: "inherit", fontSize: 13.5 }}
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={fieldDisplayValue(f.type, data[f.key])}
                    onChange={(e) => setField(item.id, f.key, f.type, e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--rule)", fontSize: 13.5 }}
                  />
                )}
              </div>
            ))}

            {data.notes && (
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", fontStyle: "italic", marginBottom: 10 }}>AI notes: {data.notes}</p>
            )}

            {(item.commitError || actionErrors[item.id]) && (
              <div className="error-box" style={{ marginBottom: 10 }}>{actionErrors[item.id] || item.commitError}</div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={() => act(item, "approve")} disabled={busyId === item.id}>
                {busyId === item.id ? "Working…" : (item.commitError ? "Retry approve" : "Approve")}
              </button>
              <button className="btn" onClick={() => act(item, "reject")} disabled={busyId === item.id}>
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
