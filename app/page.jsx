"use client";

import { useEffect, useState } from "react";

function groupBySection(subtopics) {
  const groups = {};
  for (const s of subtopics) {
    const key = `P${s.paper} \u2014 ${s.section}`;
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
            If this is a fresh deploy, run <code>npm run seed</code> against your database first — see README.md.
          </div>
        </div>
      </>
    );
  }

  if (!subtopics) return <div className="loading">Loading subtopics\u2026</div>;

  const overallMastery = subtopics.length
    ? subtopics.reduce((sum, s) => sum + s.masteryScore, 0) / subtopics.length
    : 0;
  const groups = groupBySection(subtopics);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="lede">
        {subtopics.length} subtopics \u00b7 overall mastery {Math.round(overallMastery * 100)}%. Weak, high-yield
        topics are served most often in adaptive practice \u2014 nothing is ever fully benched.
      </p>

      <div className="card">
        <a className="btn btn-primary" href="/practice">
          Start adaptive practice \u2192
        </a>
        <span style={{ marginLeft: 12, fontSize: 13, color: "var(--ink-soft)" }}>
          one question at a time, mixed across every subtopic by current weakness
        </span>
      </div>

      {Object.entries(groups).map(([section, items]) => (
        <div className="card" key={section}>
          <h2>{section}</h2>
          {items.map((s) => (
            <div className="subtopic-row" key={s.id}>
              <span className="subtopic-code">{s.id}</span>
              <span className="subtopic-text">
                <a href={`/practice/${s.id}`}>{s.topicText}</a>
                <div className="subtopic-meta">
                  {s.pyqFrequency} PYQ appearance{s.pyqFrequency === 1 ? "" : "s"} \u00b7 {s.attemptsCount} attempted \u00b7{" "}
                  <a href={`/sources/${s.id}`}>{s.sourceCount} source{s.sourceCount === 1 ? "" : "s"}</a>
                </div>
              </span>
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
