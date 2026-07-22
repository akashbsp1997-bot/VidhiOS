"use client";

import { useEffect, useState } from "react";
import { getCompulsoryLanguages } from "../../../lib/subjects/papers.js";

// Per explicit request: Paper A's 22 real Eighth-Schedule language choices
// (see lib/subjects/papers.js) get a picker of their own, same spirit as
// app/papers/optional/page.jsx -- unlike an optional subject, a language
// choice has only ONE paper (not VI and VII), so picking one here links
// straight to its subtopics page, no intermediate "both papers" step needed.
export default function CompulsoryLanguagePicker() {
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

  const languages = getCompulsoryLanguages().map((l) => {
    const tile = tiles.find((t) => t.subjectId === l.subjectId && t.paper === 1);
    return { ...l, subtopicCount: tile?.subtopicCount ?? 0, avgMasteryScore: tile?.avgMasteryScore ?? null };
  });

  return (
    <>
      {backLink}
      <h1>Choose your compulsory Indian language</h1>
      <p className="lede">
        Paper A can be written in any one of the 22 languages in the Eighth Schedule to the Constitution —
        qualifying only, 300 marks, minimum 25% to pass.
      </p>

      <div className="card">
        <div className="paper-tile-grid">
          {languages.map((l) => (
            <a
              key={l.subjectId}
              className={`paper-tile${l.subtopicCount === 0 ? " coming-soon" : ""}`}
              href={`/papers/${l.subjectId}/1`}
            >
              <div className="paper-tile-label">{l.displayName}</div>
              <div className="paper-tile-meta">
                {l.subtopicCount > 0
                  ? `${l.subtopicCount} subtopic${l.subtopicCount === 1 ? "" : "s"} · ${Math.round((l.avgMasteryScore ?? 0) * 100)}% mastery`
                  : "Coming soon"}
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
