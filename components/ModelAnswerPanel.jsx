"use client";

import { useState } from "react";

// Free, instant self-check alternative to full AI grading -- a model
// answer generated once per question and cached forever (see
// app/api/model-answer/route.js), reused by every student who meets the
// same question. Available before OR after submitting for grading; showing
// it doesn't consume any of the "grade my actual answer" AI budget.
export default function ModelAnswerPanel({ subtopicId, questionSource, questionRefId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState(null);

  function toggle() {
    if (data) {
      setShown((s) => !s);
      return;
    }
    setLoading(true);
    setError(null);
    fetch("/api/model-answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtopicId, questionSource, questionRefId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          setShown(true);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button className="btn" onClick={toggle} disabled={loading}>
        {loading ? "Loading…" : shown ? "Hide model answer" : "Show model answer"}
      </button>
      {error && (
        <div className="error-box" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {shown && data && (
        <div style={{ marginTop: 8, padding: "10px 14px", background: "var(--ivory-2)", borderRadius: 8, fontSize: 13.5 }}>
          <p style={{ whiteSpace: "pre-wrap" }}>{data.modelAnswer}</p>
          {data.keyPoints?.length > 0 && (
            <>
              <strong>Key points</strong>
              <ul>
                {data.keyPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
