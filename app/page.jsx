"use client";

import { useEffect, useState } from "react";
import { PAPER_TILES, isOptionalTile } from "../lib/subjects/papers.js";

// Groups PAPER_TILES' own static `group` field -- server order (this file's
// static array order) is preserved since JS objects preserve string-key
// insertion order, so the grid always renders Prelims -> Mains GS -> Essay ->
// Optionals in the same fixed sequence regardless of API response order.
function groupTiles(tiles) {
  const groups = {};
  for (const t of tiles) {
    groups[t.group] = groups[t.group] || [];
    groups[t.group].push(t);
  }
  return groups;
}

// This is now the top-level papers index -- the full real UPSC CSE exam
// structure (see lib/subjects/papers.js), not a flat subtopic list. A tile
// for a paper with no content yet is still clickable and still shows a
// "coming soon" page (app/papers/[subjectId]/[paper]/page.jsx) rather than
// being hidden or disabled -- explicit product choice, so the whole exam
// structure is visible now even though only Law Optional/GS2 have real
// content today.
export default function PapersIndex() {
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

  if (error) {
    return (
      <>
        <h1>VidhiOS Adaptive</h1>
        <div className="error-box">
          {error}
          <div style={{ marginTop: 8 }}>
            If this is a fresh deploy, visit <code>/api/setup?key=YOUR_SETUP_SECRET</code> first.
          </div>
        </div>
      </>
    );
  }

  if (!tiles) return <div className="loading">Loading papers…</div>;

  const withContent = tiles.filter((t) => t.subtopicCount > 0);
  const overallMastery = withContent.length
    ? withContent.reduce((sum, t) => sum + (t.avgMasteryScore ?? 0), 0) / withContent.length
    : 0;

  // Optional-subject paper tiles (Law/Literature Paper VI, VII) don't render
  // directly on this top-level grid -- clicking straight into "Paper VI"
  // without first knowing which optional subject it belongs to isn't
  // meaningful. Instead they're collapsed into one "Optional Subject" entry
  // point that goes to app/papers/optional/page.jsx (choose a subject), then
  // app/papers/optional/[subjectId]/page.jsx (both of that subject's papers,
  // per explicit request). The individual paper tiles from /api/papers are
  // still what those two pages render -- only this top-level grid excludes
  // them, so their real subtopicCount/mastery data isn't duplicated anywhere.
  const optionalTiles = tiles.filter(isOptionalTile);
  const optionalWithContent = optionalTiles.filter((t) => t.subtopicCount > 0);
  const optionalSubtopicCount = optionalTiles.reduce((sum, t) => sum + t.subtopicCount, 0);
  const optionalAvgMastery = optionalWithContent.length
    ? optionalWithContent.reduce((sum, t) => sum + t.subtopicCount * (t.avgMasteryScore ?? 0), 0) /
      optionalWithContent.reduce((sum, t) => sum + t.subtopicCount, 0)
    : null;
  const groups = groupTiles(tiles.filter((t) => !isOptionalTile(t)));

  return (
    <>
      <h1>Dashboard</h1>
      <p className="lede">
        Every UPSC CSE paper, in one place — {withContent.length} of {tiles.length} have content loaded so far
        (overall mastery {Math.round(overallMastery * 100)}%); the rest are marked "coming soon" until content is
        added. Click a paper to see its subtopics.
      </p>

      <div className="card">
        <a className="btn btn-primary" href="/practice">
          Start adaptive practice →
        </a>
        <span style={{ marginLeft: 12, fontSize: 13, color: "var(--ink-soft)" }}>
          one question at a time, across every paper with content, mixed by current weakness
        </span>
      </div>

      {Object.entries(groups).map(([group, items]) => (
        <div className="card" key={group}>
          <h2>{group}</h2>
          <div className="paper-tile-grid">
            {items.map((t) => (
              <a
                key={`${t.subjectId}-${t.paper}`}
                className={`paper-tile${t.subtopicCount === 0 ? " coming-soon" : ""}`}
                href={`/papers/${t.subjectId}/${t.paper}`}
              >
                <div className="paper-tile-label">
                  {t.label}
                  {t.qualifying && <span className="qualifying-pill">Qualifying</span>}
                </div>
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
      ))}

      <div className="card">
        <h2>CSE Mains — Merit — Optional Subject</h2>
        <div className="paper-tile-grid">
          <a className={`paper-tile${optionalSubtopicCount === 0 ? " coming-soon" : ""}`} href="/papers/optional">
            <div className="paper-tile-label">Paper VI &amp; VII: Optional Subject</div>
            <div className="paper-tile-meta">
              {optionalSubtopicCount > 0
                ? `${optionalSubtopicCount} subtopics across your optional · ${Math.round((optionalAvgMastery ?? 0) * 100)}% mastery · choose a subject →`
                : "Choose your optional subject →"}
            </div>
          </a>
        </div>
      </div>
    </>
  );
}
