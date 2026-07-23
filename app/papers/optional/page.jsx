"use client";

import { useEffect, useState } from "react";
import { getOptionalSubjects, isOptionalTile } from "../../../lib/subjects/papers.js";

// Per explicit request: the top-level dashboard no longer shows individual
// optional-subject paper tiles directly (see app/page.jsx) -- clicking
// straight into "Paper VI" without first knowing which optional subject it
// belongs to isn't meaningful. This page is the intermediate step: pick a
// subject (Law, Literature, ...), then app/papers/optional/[subjectId]/page.jsx
// shows both of ITS papers (VI and VII) together.
export default function OptionalSubjectPicker() {
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
      <a href="/">← All papers</a>
    </p>
  );

  if (error) {
    return (
      <>
        {backLink}
        <div className="error-box">{error}</div>
      </>
    );
  }

  if (!tiles) return <div className="loading">Loading…</div>;

  const optionalTiles = tiles.filter(isOptionalTile);
  const subjects = getOptionalSubjects().map((s) => {
    const papers = optionalTiles.filter((t) => t.subjectId === s.subjectId);
    const subtopicCount = papers.reduce((sum, t) => sum + t.subtopicCount, 0);
    const withContent = papers.filter((t) => t.subtopicCount > 0);
    const avgMastery = withContent.length
      ? withContent.reduce((sum, t) => sum + t.subtopicCount * (t.avgMasteryScore ?? 0), 0) /
        withContent.reduce((sum, t) => sum + t.subtopicCount, 0)
      : null;
    // Every paper tile for one optional subject shares the same
    // subjectLocked value (it's a per-subject gate, see /api/papers) --
    // reading it off the first one is enough.
    const subjectLocked = papers[0]?.subjectLocked ?? false;
    return { ...s, subtopicCount, avgMastery, subjectLocked };
  });

  return (
    <>
      {backLink}
      <h1>Choose your optional subject</h1>
      <p className="lede">
        Pick the optional subject you're preparing — both its papers (VI and VII) open up once you do. This choice
        is fixed once made, matching how the real exam works — you only ever sit one optional.
        {" "}<a href="/onboarding">Set up your plan</a> if you haven't yet.
      </p>

      <div className="card">
        <div className="paper-tile-grid">
          {subjects.map((s) =>
            s.subjectLocked ? (
              <div className="paper-tile subject-locked" key={s.subjectId}>
                <div className="paper-tile-label">
                  {s.displayName}
                  <span className="subject-locked-pill">Locked</span>
                </div>
                <div className="paper-tile-meta">Not your chosen optional</div>
              </div>
            ) : (
              <a key={s.subjectId} className={`paper-tile${s.subtopicCount === 0 ? " coming-soon" : ""}`} href={`/papers/optional/${s.subjectId}`}>
                <div className="paper-tile-label">{s.displayName}</div>
                <div className="paper-tile-meta">
                  {s.subtopicCount > 0
                    ? `${s.subtopicCount} subtopics · ${Math.round((s.avgMastery ?? 0) * 100)}% mastery`
                    : "Coming soon"}
                </div>
              </a>
            )
          )}
        </div>
      </div>
    </>
  );
}
