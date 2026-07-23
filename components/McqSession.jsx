"use client";

import { useEffect, useState, useCallback } from "react";

const OPTION_LETTER = ["A", "B", "C", "D"];

// Prelims-style MCQ practice -- deliberately its own component rather than a
// mode toggle inside PracticeSession.jsx: different question shape (options,
// no free-text answer), deterministic instant grading (no "Grading…" wait),
// and it tracks accuracy separately from descriptive mastery (see
// app/api/mcq/route.js's header comment).
export default function McqSession() {
  const [question, setQuestion] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [gradingError, setGradingError] = useState(null);

  const loadNext = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setGradingError(null);
    setResult(null);
    setSelectedIndex(null);
    fetch("/api/mcq")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else setQuestion(data);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  function submitAnswer() {
    if (!question || selectedIndex == null) return;
    setGrading(true);
    setGradingError(null);
    fetch("/api/mcq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtopicId: question.subtopicId, questionRefId: question.questionRefId, selectedIndex }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setGradingError(data.error);
        else {
          setResult(data);
          setStats(data.stats);
        }
      })
      .catch((e) => setGradingError(e.message))
      .finally(() => setGrading(false));
  }

  if (loading) return <div className="loading">Picking your next MCQ…</div>;

  if (loadError === "onboarding_not_complete") {
    return (
      <div className="card">
        <p className="lede" style={{ marginBottom: 10 }}>
          Set up your plan first — pick your 2 starting GS papers and your optional subject.
        </p>
        <a className="btn btn-primary" href="/onboarding">
          Get started →
        </a>
      </div>
    );
  }

  if (loadError)
    return (
      <div className="error-box">
        {loadError}
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={loadNext}>
            Try again
          </button>
        </div>
      </div>
    );

  if (!question) return null;

  return (
    <>
      {stats && (
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 10 }}>
          {stats.correct}/{stats.attempted} correct so far this session ({stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0}%)
        </p>
      )}

      <div className="card">
        <div className="meta-line">
          {question.subtopicId} · {question.subtopicText}
        </div>

        <div className="question-text">{question.questionText}</div>

        {!result && (
          <>
            <div style={{ marginTop: 12 }}>
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  className={`seg${selectedIndex === i ? " active" : ""}`}
                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8 }}
                  onClick={() => setSelectedIndex(i)}
                  disabled={grading}
                >
                  <b>{OPTION_LETTER[i]}.</b> {opt}
                </button>
              ))}
            </div>
            {gradingError && (
              <div className="error-box" style={{ marginTop: 10 }}>
                {gradingError}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={submitAnswer} disabled={grading || selectedIndex == null}>
                {grading ? "Checking…" : gradingError ? "Retry" : "Submit answer"}
              </button>
            </div>
          </>
        )}

        {result && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontWeight: 700, color: result.correct ? "var(--forest)" : "var(--maroon)" }}>
              {result.correct ? "Correct!" : `Incorrect — the correct answer is ${OPTION_LETTER[result.correctIndex]}.`}
            </p>
            {question.options.map((opt, i) => (
              <div
                key={i}
                style={{
                  padding: "7px 12px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: "1px solid var(--rule)",
                  background: i === result.correctIndex ? "#dcebe0" : i === selectedIndex ? "#f0dfda" : "var(--ivory-2)",
                  fontSize: 13.5,
                }}
              >
                <b>{OPTION_LETTER[i]}.</b> {opt}
              </div>
            ))}
            {result.explanation && <p style={{ fontSize: 13.5, marginTop: 8 }}>{result.explanation}</p>}
            <button className="btn btn-primary" onClick={loadNext} style={{ marginTop: 8 }}>
              Next question →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
