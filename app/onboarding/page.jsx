"use client";

import { useEffect, useState } from "react";

// One-time setup: 2 GS papers + 1 optional subject, unlocked together (see
// lib/adaptive/subjectUnlockState.js's initializeSubjectUnlocks). More GS
// papers unlock automatically later (mastery or a calendar checkpoint,
// whichever comes first) -- the optional choice stays fixed after this,
// matching how a real UPSC candidate only ever sits one optional paper.
export default function OnboardingPage() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [gsSelection, setGsSelection] = useState([]);
  const [optionalSubjectId, setOptionalSubjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setState(data);
        setGsSelection(data.onboardingComplete ? data.unlockedGsIds : data.recommendedGsSubjectIds);
        if (data.onboardingComplete) setOptionalSubjectId(data.optionalSubjectId ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);

  function toggleGs(id) {
    setGsSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // keep it a rolling pair rather than blocking the click
      return [...prev, id];
    });
  }

  async function submit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gsSubjectIds: gsSelection, optionalSubjectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Could not save your plan.");
        return;
      }
      window.location.href = "/";
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <>
        <h1>Set up your plan</h1>
        <div className="error-box">{error}</div>
      </>
    );
  }

  if (!state) return <div className="loading">Loading…</div>;

  if (state.onboardingComplete) {
    return (
      <>
        <p style={{ fontSize: 12.5, marginBottom: 12 }}>
          <a href="/">← Dashboard</a>
        </p>
        <h1>Your plan is already set up</h1>
        <p className="lede">
          GS unlocked so far: {state.unlockedGsIds.join(", ").toUpperCase() || "none yet"}. Optional subject:{" "}
          {state.optionalSubjects.find((s) => s.subjectId === state.optionalSubjectId)?.displayName ?? state.optionalSubjectId}.
          More GS papers unlock automatically as you make progress.
        </p>
      </>
    );
  }

  const canSubmit = gsSelection.length === 2 && !!optionalSubjectId;

  return (
    <>
      <p style={{ fontSize: 12.5, marginBottom: 12 }}>
        <a href="/">← Dashboard</a>
      </p>
      <h1>Set up your 1-year plan</h1>
      <p className="lede">
        Pick 2 GS papers to start with — GS I and GS II are recommended, but you can pick any two. More GS papers
        unlock automatically as you make progress (mastery or time, whichever comes first). Then pick your one
        optional subject — this is fixed once you start, matching how the real exam works.
      </p>

      <div className="card">
        <h2>GS papers (pick 2)</h2>
        <div className="segmented">
          {state.gsSubjects.map((s) => (
            <button key={s.id} className={`seg${gsSelection.includes(s.id) ? " active" : ""}`} onClick={() => toggleGs(s.id)}>
              {s.displayName}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Optional subject</h2>
        <select
          value={optionalSubjectId}
          onChange={(e) => setOptionalSubjectId(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--rule)", background: "var(--ivory-2)" }}
        >
          <option value="">Choose your optional subject…</option>
          {state.optionalSubjects.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>
              {s.displayName}
            </option>
          ))}
        </select>
      </div>

      {submitError && <div className="error-box">{submitError}</div>}

      <button className="btn btn-primary" disabled={!canSubmit || submitting} onClick={submit}>
        {submitting ? "Saving…" : "Start my plan →"}
      </button>
    </>
  );
}
