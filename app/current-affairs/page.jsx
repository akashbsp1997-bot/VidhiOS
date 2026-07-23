"use client";

import { useEffect, useState } from "react";

function groupByDate(items) {
  const groups = {};
  for (const it of items) (groups[it.publishedDate] ??= []).push(it);
  return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export default function CurrentAffairsPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/current-affairs?days=7")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setItems(data.items);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <>
        <h1>Current affairs</h1>
        <div className="error-box">{error}</div>
      </>
    );
  }

  if (!items) return <div className="loading">Loading…</div>;

  if (items.length === 0) {
    return (
      <>
        <h1>Current affairs</h1>
        <div className="card">
          <p className="lede" style={{ marginBottom: 0 }}>
            No digest items yet. This feature needs a free NewsData.io API key configured on the server (see
            README) — once set, a daily job fetches and summarizes India-focused news relevant to the syllabus.
          </p>
        </div>
      </>
    );
  }

  const grouped = groupByDate(items);

  return (
    <>
      <h1>Current affairs</h1>
      <p className="lede">
        Last 7 days, auto-summarized and tagged to real syllabus topics where relevant — a daily job, not something
        you need to check for updates on.
      </p>

      {grouped.map(([date, dayItems]) => (
        <div className="card" key={date}>
          <h2>{new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
          {dayItems.map((it) => (
            <div key={it.id} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14.5, marginBottom: 2 }}>
                <a href={it.sourceUrl} target="_blank" rel="noreferrer">
                  {it.title}
                </a>
              </h3>
              {it.sourceName && <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 4px" }}>{it.sourceName}</p>}
              <p style={{ fontSize: 13.5, margin: "0 0 6px" }}>{it.summary}</p>
              {it.relatedTopics.length > 0 && (
                <div>
                  {it.relatedTopics.map((t) => (
                    <a key={t.id} href={`/learn/${t.id}`} className="qualifying-pill" style={{ marginRight: 6, textDecoration: "none" }}>
                      {t.topicText}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
