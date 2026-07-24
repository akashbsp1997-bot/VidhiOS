"use client";

import { useEffect, useState } from "react";

// Yesterday plus the 13 days before it -- results older than that are still
// browsable via a direct ?date= if anyone wants them, but the picker itself
// stays short. Yesterday first (not today), since "today" has no grading run
// yet by definition of when this page is normally viewed.
function dateOptions() {
  const opts = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const value = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

export default function ResultsPage() {
  const options = dateOptions();
  const [date, setDate] = useState(options[0].value);
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDigest(null);
    fetch(`/api/results/daily?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setDigest(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <>
      <h1>Results</h1>
      <p className="lede">
        Answers are graded once a day, overnight — this is the day-by-day archive of what got graded and how it
        went, not a live feed.
      </p>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Daily results</h2>
          <select value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: 13 }}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {loading && <div className="loading">Loading…</div>}
        {error && <div className="error-box">{error}</div>}

        {digest && digest.itemCount === 0 && (
          <p className="lede" style={{ marginBottom: 0 }}>
            Nothing was graded on this day — either nothing was submitted, or tonight's grading run hasn't happened
            yet.
          </p>
        )}

        {digest && digest.itemCount > 0 && (
          <>
            <p style={{ fontSize: 13.5, marginBottom: 12 }}>
              {digest.itemCount} answer{digest.itemCount === 1 ? "" : "s"} graded · average score{" "}
              {Math.round(digest.avgScore)}/100
            </p>
            {digest.bySubtopic.map((b) => (
              <div key={b.subtopicId} className="subtopic-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <a href={`/learn/${encodeURIComponent(b.subtopicId)}`} className="subtopic-text">
                  {b.topicText}
                </a>
                <span className="tier-pill">
                  {Math.round(b.avgScore)}/100 · {b.itemCount} item{b.itemCount === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
