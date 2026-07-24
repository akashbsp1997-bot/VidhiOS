"use client";

import { useEffect, useState } from "react";

const PACE_LABEL = { ahead: "Ahead of pace", on_pace: "On pace", behind: "Behind pace" };
const PACE_BORDER = { ahead: "var(--forest)", on_pace: "var(--brass)", behind: "var(--maroon)" };

// Aggregates what /plan and /guide each show in pieces into one "how ready
// am I" view -- a streak, a weak-area heatmap, and descriptive/MCQ/mock-test
// performance side by side. Deliberately no single blended score (see
// lib/adaptive/readiness.js) -- these are different signals, not one number.
export default function ReadinessPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/readiness")
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
        <h1>Readiness</h1>
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
        <h1>Readiness</h1>
        <div className="error-box">{error}</div>
      </>
    );
  }

  if (!data) return <div className="loading">Loading…</div>;

  const weakest = data.heatmap.filter((h) => h.attemptsCount > 0).slice(0, 3);

  return (
    <>
      <h1>Readiness</h1>
      <p className="lede">
        Where you stand across everything you've unlocked — a study streak, your weakest areas, and how you're
        doing across practice, Prelims MCQs, and mock tests. All computed from your own tracked activity.
      </p>

      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{data.streak.current}</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>day streak {data.streak.current > 0 ? "(active)" : "(start today)"}</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{data.streak.best}</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>best streak</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{data.streak.daysActive}</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>days active total</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{Math.round(data.overallMastery * 100)}%</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>overall mastery</div>
          </div>
        </div>
      </div>

      {data.pace && (
        <div className="card" style={{ borderColor: PACE_BORDER[data.pace.status] }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
            <h2 style={{ margin: 0 }}>Pace toward your 1-year goal</h2>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: PACE_BORDER[data.pace.status] }}>{PACE_LABEL[data.pace.status]}</span>
          </div>
          <p className="lede" style={{ marginBottom: 8 }}>
            Day {data.pace.dayNumber} of 365, aiming for 70% average mastery across your unlocked syllabus (real UPSC
            toppers often clear well under 60% of total marks — this target is deliberately higher). Re-anchored to
            your own actual progress every 30 days, not a fixed straight line from day one.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(data.pace.currentMasteryPct)}%</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>where you are today</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(data.pace.expectedMasteryPct)}%</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>expected by today, this window</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(data.pace.projectedFinalMasteryPct)}%</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>projected at day 365, at your current rate</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div>
            <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>Descriptive practice</h3>
            <p style={{ fontSize: 13, margin: 0 }}>
              {data.descriptive.attempted} graded{data.descriptive.avgScore != null ? ` · avg ${data.descriptive.avgScore}/100` : ""}
              {data.descriptive.pendingGrading > 0 && ` · ${data.descriptive.pendingGrading} pending tonight's grading`}
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>Prelims MCQs</h3>
            <p style={{ fontSize: 13, margin: 0 }}>
              {data.mcq.attempted === 0 ? "None attempted yet" : `${data.mcq.correct}/${data.mcq.attempted} correct (${Math.round((data.mcq.correct / data.mcq.attempted) * 100)}%)`}
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13.5, marginBottom: 4 }}>Mock tests</h3>
            <p style={{ fontSize: 13, margin: 0 }}>
              {data.mockTests.count === 0 ? "None graded yet" : `${data.mockTests.count} taken · avg ${data.mockTests.avgPct}%`}
              {data.mockTests.pendingGrading > 0 && ` · ${data.mockTests.pendingGrading} pending tonight's grading`}
            </p>
          </div>
        </div>
      </div>

      {weakest.length > 0 && (
        <div className="card" style={{ borderColor: "var(--brass)" }}>
          <h2 style={{ marginTop: 0 }}>Focus areas</h2>
          <p className="lede" style={{ marginBottom: 8 }}>Your lowest-mastery areas among topics you've actually attempted.</p>
          {weakest.map((h) => (
            <p key={`${h.subjectId}::${h.section}`} style={{ fontSize: 13.5, margin: "4px 0" }}>
              <b>{h.section}</b> ({h.subjectDisplayName}) — {Math.round(h.avgMastery * 100)}% mastery
            </p>
          ))}
        </div>
      )}

      {data.mockTests.recent.length > 0 && (
        <div className="card">
          <h2>Recent mock tests</h2>
          {data.mockTests.recent.map((m, i) => (
            <div className="subtopic-row" key={i} style={{ gridTemplateColumns: "1fr auto auto" }}>
              <span className="subtopic-text">
                {m.subjectDisplayName} — {m.size}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{new Date(m.submittedAt).toLocaleDateString()}</span>
              <span className="tier-pill">{m.totalScore != null ? `${m.totalScore}/${m.totalMarks}` : "grading…"}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Weak-area heatmap</h2>
        <p className="lede" style={{ marginBottom: 10 }}>
          Every unlocked theme/section, weakest first.
        </p>
        {data.heatmap.map((h) => (
          <div className="subtopic-row" key={`${h.subjectId}::${h.section}`} style={{ gridTemplateColumns: "1fr auto auto" }}>
            <span className="subtopic-text">
              {h.section}
              <div className="subtopic-meta">
                {h.subjectDisplayName} · {h.subtopicCount} topics · {h.attemptsCount} attempts
              </div>
            </span>
            <span className="bar" title={`${Math.round(h.avgMastery * 100)}% mastery`} style={{ width: 100 }}>
              <span style={{ width: `${Math.round(h.avgMastery * 100)}%` }} />
            </span>
            <span className="tier-pill">{Math.round(h.avgMastery * 100)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}
