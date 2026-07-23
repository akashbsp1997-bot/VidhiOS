"use client";

import { useEffect, useState } from "react";

const SELF_STATUS_LABEL = { "not-started": "Not started", "in-progress": "In progress", done: "Done" };

// A printable revision booklet -- personal notes + AI-generated key points
// (already produced by a real Teach visit, nothing freshly generated here)
// across every unlocked subject, grouped by theme/section. The browser's
// own "Print / Save as PDF" does the actual export; no PDF library needed.
export default function NotesExportPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/notes-export")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error === "onboarding_not_complete") {
    return (
      <>
        <h1>Export notes</h1>
        <div className="card">
          <p className="lede" style={{ marginBottom: 10 }}>
            Set up your plan first — pick your 2 starting GS papers and your optional subject.
          </p>
          <a className="btn btn-primary" href="/onboarding">
            Get started →
          </a>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>Export notes</h1>
        <div className="error-box">{error}</div>
      </>
    );
  }

  if (!data) return <div className="loading">Loading…</div>;

  return (
    <>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <h1>Export notes</h1>
        <p className="lede">
          A printable revision booklet — your own notes plus AI-generated key points, across everything you've
          unlocked. Use your browser's Print (or Save as PDF) to export it.
        </p>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      {data.sections.length === 0 && (
        <div className="card">
          <p className="lede" style={{ marginBottom: 0 }}>
            No content loaded yet in your unlocked subjects.
          </p>
        </div>
      )}

      {data.sections.map((sec) => (
        <div className="card" key={`${sec.subjectId}::${sec.section}`}>
          <h2 style={{ marginBottom: 2 }}>{sec.section}</h2>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 14 }}>{sec.subjectDisplayName}</p>

          {sec.subtopics.map((s) => (
            <div key={s.id} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14.5, marginBottom: 2 }}>
                {s.topicText}{" "}
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-soft)" }}>
                  ({SELF_STATUS_LABEL[s.selfStatus]} · {Math.round(s.masteryScore * 100)}% mastery)
                </span>
              </h3>

              {s.personalNotes?.trim() && (
                <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap", marginBottom: 6 }}>{s.personalNotes}</p>
              )}

              {s.aiKeyPoints.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {s.aiKeyPoints.map((kp, i) => (
                    <li key={i}>{kp}</li>
                  ))}
                </ul>
              )}

              {!s.personalNotes?.trim() && s.aiKeyPoints.length === 0 && (
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>No notes yet.</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
