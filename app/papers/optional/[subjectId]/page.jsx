"use client";

import { useEffect, useState, use } from "react";
import { getOptionalSubjectPapers, getOptionalSubjects } from "../../../../lib/subjects/papers.js";

// Both papers (VI and VII) for ONE chosen optional subject, per explicit
// request: after picking a subject on app/papers/optional/page.jsx, both of
// its papers should be visible together here, rather than navigating
// straight to one paper's subtopic list.
export default function OptionalSubjectPapers({ params }) {
  const { subjectId } = use(params);
  const subjectMeta = getOptionalSubjects().find((s) => s.subjectId === subjectId);
  const staticPapers = getOptionalSubjectPapers(subjectId);

  const [tiles, setTiles] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/papers")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTiles(data.tiles);
      })
      .catch((e) => setError(e.message));
  }, []);

  const backLink = (
    <p style={{ fontSize: 12.5, marginBottom: 12 }}>
      <a href="/papers/optional">← Choose a different optional</a>
    </p>
  );

  if (!staticPapers.length) {
    return (
      <>
        {backLink}
        <div className="error-box">Unknown optional subject "{subjectId}".</div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {backLink}
        <div className="error-box">{error}</div>
      </>
    );
  }

  if (!tiles) return <div className="loading">Loading…</div>;

  // Enrich the static paper shape (label/marks) with live subtopicCount/
  // mastery from /api/papers -- falls back to the static entry (0 count) if
  // that specific (subjectId, paper) somehow isn't in the API response.
  const papers = staticPapers.map((p) => tiles.find((t) => t.subjectId === p.subjectId && t.paper === p.paper) || { ...p, subtopicCount: 0, avgMasteryScore: null });

  return (
    <>
      {backLink}
      <h1>{subjectMeta?.displayName ?? subjectId}</h1>
      <p className="lede">Both papers for this optional subject.</p>

      <div className="card">
        <div className="paper-tile-grid">
          {papers.map((t) => (
            <a
              key={`${t.subjectId}-${t.paper}`}
              className={`paper-tile${t.subtopicCount === 0 ? " coming-soon" : ""}`}
              href={`/papers/${t.subjectId}/${t.paper}`}
            >
              <div className="paper-tile-label">{t.label}</div>
              <div className="paper-tile-meta">
                {t.marks ? `${t.marks} marks · ` : ""}
                {t.subtopicCount > 0
                  ? `${t.subtopicCount} subtopic${t.subtopicCount === 1 ? "" : "s"} · ${Math.round((t.avgMasteryScore ?? 0) * 100)}% mastery`
                  : "Coming soon"}
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
