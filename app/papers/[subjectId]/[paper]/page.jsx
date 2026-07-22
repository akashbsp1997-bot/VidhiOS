"use client";

import { useEffect, useState, use } from "react";
import { findPaperTile } from "../../../../lib/subjects/papers.js";

const STAGE_LABEL = { teach: "Teach", grasp: "Grasp", remember: "Remember", test: "Test" };

// Same thresholds as the old flat dashboard's difficultyLabel -- even
// thirds, since app/api/subtopics/route.js's difficultyScore is already a
// rough blend of two proxies, not a calibrated difficulty measure.
function difficultyLabel(score) {
  if (score < 0.35) return "Foundational";
  if (score < 0.65) return "Intermediate";
  return "Advanced";
}

// A single-paper subject's (GS papers, Essay, both Prelims papers) tile
// label already IS the full paper name. The two-paper optional subjects
// (Law, Literature) only carry "Paper I"/"Paper II" as their label, so this
// prefixes the optional's own name (pulled from the tile's `group`, e.g.
// "CSE Mains — Optional: Law" -> "Law"). Fully static -- doesn't need the
// subtopics API response, so the heading is correct even before/without any
// data loading (the "coming soon" case).
function paperHeading(tile) {
  if (!tile) return null;
  const optionalMatch = tile.group.match(/Optional: (.+)$/);
  return optionalMatch ? `${optionalMatch[1]} Optional — ${tile.label}` : tile.label;
}

export default function PaperSubtopicsPage({ params }) {
  const { subjectId, paper: paperParam } = use(params);
  const paper = Number(paperParam);
  const tile = findPaperTile(subjectId, paper);
  const heading = paperHeading(tile) ?? subjectId;

  const [subtopicsData, setSubtopicsData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSubtopicsData(null);
    setError(null);
    fetch(`/api/subtopics?subjectId=${encodeURIComponent(subjectId)}&paper=${paper}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSubtopicsData(data.subtopics);
      })
      .catch((e) => setError(e.message));
  }, [subjectId, paper]);

  const backLink = (
    <p style={{ fontSize: 12.5, marginBottom: 12 }}>
      <a href="/">← All papers</a>
    </p>
  );

  if (error) {
    return (
      <>
        {backLink}
        <h1>{heading}</h1>
        <div className="error-box">{error}</div>
      </>
    );
  }

  if (!subtopicsData) return <div className="loading">Loading…</div>;

  if (subtopicsData.length === 0) {
    return (
      <>
        {backLink}
        <h1>{heading}</h1>
        <div className="card">
          <h2>Coming soon</h2>
          <p className="lede" style={{ marginBottom: 0 }}>
            This paper doesn't have subtopics loaded yet. Check back once content has been added.
          </p>
        </div>
      </>
    );
  }

  const overallMastery = subtopicsData.reduce((sum, s) => sum + s.masteryScore, 0) / subtopicsData.length;

  return (
    <>
      {backLink}
      <h1>{heading}</h1>
      <p className="lede">
        {subtopicsData.length} subtopics · overall mastery {Math.round(overallMastery * 100)}%. Ordered as a
        basics-to-advanced study path; weak, high-yield topics are still served most often in adaptive practice
        regardless of this order — nothing is ever fully benched.
      </p>

      <div className="card">
        {subtopicsData.map((s) => (
          <div className={`subtopic-row${s.locked ? " locked" : ""}`} key={s.id}>
            <span className="subtopic-code">{s.id}</span>
            <span className="subtopic-text">
              {s.locked ? <span>{s.topicText}</span> : <a href={`/learn/${s.id}`}>{s.topicText}</a>}
              <div className="subtopic-meta">
                {s.locked ? (
                  <span className="locked-pill">
                    Locked — reach {s.requiredMasteryPct}% mastery on {s.requiredSubtopicText} first (
                    {s.currentMasteryPct}%/{s.requiredMasteryPct}%)
                  </span>
                ) : (
                  <>
                    {s.section} · {s.pyqFrequency} PYQ appearance{s.pyqFrequency === 1 ? "" : "s"} · {s.attemptsCount}{" "}
                    attempted ·{" "}
                    <a href={`/sources/${s.id}`}>
                      {s.sourceCount} source{s.sourceCount === 1 ? "" : "s"}
                    </a>
                  </>
                )}
              </div>
            </span>
            <span className="tier-pill" style={{ fontSize: 11 }}>
              {difficultyLabel(s.difficultyScore)}
            </span>
            <span className={`stage-pill stage-${s.stage}`}>{STAGE_LABEL[s.stage]}</span>
            <span className={`tier-pill${s.currentTier === 3 ? " t3" : ""}`}>tier {s.currentTier}</span>
            <span className="bar" title={`${Math.round(s.masteryScore * 100)}% mastery`}>
              <span style={{ width: `${Math.round(s.masteryScore * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
