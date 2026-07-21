"use client";

import { useEffect, useState } from "react";

const STAGE_LABEL = { teach: "Teach", grasp: "Grasp", remember: "Remember", test: "Test" };

// Buckets app/api/subtopics/route.js's 0-1 difficultyScore into a label a
// student recognizes at a glance -- thresholds are even thirds, nothing
// more precise is warranted given the score itself is already a rough
// blend of two proxies (source-tier composition + PYQ marks), not a
// calibrated difficulty measure.
function difficultyLabel(score) {
  if (score < 0.35) return "Foundational";
  if (score < 0.65) return "Intermediate";
  return "Advanced";
}

// Groups by paper only (not paper+section like this page used to) -- the
// order within a paper is now a basics-to-advanced study path (see the
// API route's sort), which would be broken up if subtopics were also
// bucketed by syllabus section. Section is still shown per-subtopic below,
// just as inline metadata instead of a group header.
function groupByPaper(subtopics) {
  const groups = {};
  for (const s of subtopics) {
    const key = `${s.subjectDisplayName} · Paper ${s.paper}`;
    groups[key] = groups[key] || [];
    groups[key].push(s);
  }
  return groups;
}

export default function Dashboard() {
  const [subtopics, setSubtopics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/subtopics")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSubtopics(data.subtopics);
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

  if (!subtopics) return <div className="loading">Loading subtopics…</div>;

  const overallMastery = subtopics.length
    ? subtopics.reduce((sum, s) => sum + s.masteryScore, 0) / subtopics.length
    : 0;
  const groups = groupByPaper(subtopics);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="lede">
        {subtopics.length} subtopics · overall mastery {Math.round(overallMastery * 100)}%. Each paper below is
        ordered as a basics-to-advanced study path; weak, high-yield topics are still served most often in
        adaptive practice regardless of this order — nothing is ever fully benched.
      </p>

      <div className="card">
        <a className="btn btn-primary" href="/practice">
          Start adaptive practice →
        </a>
        <span style={{ marginLeft: 12, fontSize: 13, color: "var(--ink-soft)" }}>
          one question at a time, mixed across every subtopic by current weakness
        </span>
      </div>

      {Object.entries(groups).map(([paper, items]) => (
        <div className="card" key={paper}>
          <h2>{paper}</h2>
          {items.map((s) => (
            <div className="subtopic-row" key={s.id}>
              <span className="subtopic-code">{s.id}</span>
              <span className="subtopic-text">
                <a href={`/learn/${s.id}`}>{s.topicText}</a>
                <div className="subtopic-meta">
                  {s.section} · {s.pyqFrequency} PYQ appearance{s.pyqFrequency === 1 ? "" : "s"} · {s.attemptsCount}{" "}
                  attempted ·{" "}
                  <a href={`/sources/${s.id}`}>
                    {s.sourceCount} source{s.sourceCount === 1 ? "" : "s"}
                  </a>
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
      ))}
    </>
  );
}
