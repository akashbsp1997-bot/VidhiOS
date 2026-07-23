"use client";

import { useEffect, useState } from "react";
import { isStorageSentinel } from "../../lib/ingest/storageUrl.js";

const TIER_LABEL = { ncert: "NCERT", official: "Government / official", newspaper: "Current affairs", private_vendor: "External" };

// The "static GK reference" piece -- deliberately a search over sources
// you've already registered/ingested (see lib/sources/tiers.js), not an
// AI-answered lookup. Zero fabrication risk; honestly only as complete as
// what's been added so far via /papers/*/sources or the ingest pipeline.
export default function ReferencePage() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (tier) params.set("tier", tier);
    const handle = setTimeout(() => {
      fetch(`/api/sources-search?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) setError(d.error);
          else {
            setData(d);
            setError(null);
          }
        })
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, tier]);

  if (error === "onboarding_not_complete") {
    return (
      <>
        <h1>Reference</h1>
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

  return (
    <>
      <h1>Reference</h1>
      <p className="lede">
        Search across every source you've registered — NCERT, official/government material, current affairs,
        external links — across all your unlocked subjects. Only as complete as what's been added so far.
      </p>

      <div className="card">
        <input
          type="text"
          placeholder="Search titles and cached text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", marginBottom: 10, borderRadius: 8, border: "1px solid var(--rule)" }}
        />
        <div className="segmented">
          <button className={`seg${tier === "" ? " active" : ""}`} onClick={() => setTier("")}>
            All
          </button>
          {Object.entries(TIER_LABEL).map(([key, label]) => (
            <button key={key} className={`seg${tier === key ? " active" : ""}`} onClick={() => setTier(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && error !== "onboarding_not_complete" && <div className="error-box">{error}</div>}

      {data && (
        <div className="card">
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 10 }}>
            {data.totalMatched} source{data.totalMatched === 1 ? "" : "s"}
            {data.totalMatched > data.results.length ? ` (showing first ${data.results.length})` : ""}
          </p>
          {data.results.map((r) => (
            <div className="subtopic-row" key={r.id} style={{ gridTemplateColumns: "1fr auto" }}>
              <span className="subtopic-text">
                {isStorageSentinel(r.url) ? (
                  <a href={`/sources/${r.subtopicId}`}>{r.title}</a>
                ) : (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                )}
                <div className="subtopic-meta">{r.subtopicText}</div>
              </span>
              <span className="qualifying-pill">{TIER_LABEL[r.sourceTier] ?? "Other"}</span>
            </div>
          ))}
          {data.results.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>No sources match yet.</p>
          )}
        </div>
      )}
    </>
  );
}
