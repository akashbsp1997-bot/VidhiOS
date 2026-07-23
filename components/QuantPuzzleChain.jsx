"use client";

import { useEffect, useState, useCallback } from "react";
import LockdownNotice from "./LockdownNotice.jsx";

const OPTION_LETTER = ["A", "B", "C", "D"];
const SUBJECT_ID = "prelims-csat";

// Quant Puzzle Chain: the second of this app's per-content-area "different
// games" (Quiz Arcade for Prelims MCQ was the first). Deliberately a
// different mechanic, not a reskin -- no timer, no round length. Instead:
// how long a CHAIN of correct answers can you build before one wrong answer
// breaks it? Difficulty escalates with chain length (tier 1 for puzzles
// 1-3, tier 2 for 4-6, tier 3 for 7+, see tierForChainLength), so the
// puzzle-chain tension is genuinely different from the arcade's speed
// pressure -- it's "how far can I go," not "how fast can I answer."
// Layered on the same real /api/mcq fetch/grade cycle as McqSession.jsx,
// just targeting the CSAT quant subject explicitly via ?subjectId= and
// ?difficultyTier= (see app/api/mcq/route.js's header for why those params
// exist) instead of the general unlocked-subjects pool.
function tierForChainLength(chainLength) {
  return Math.min(3, 1 + Math.floor(chainLength / 3));
}

const POINTS_PER_TIER = { 1: 20, 2: 35, 3: 60 };

export default function QuantPuzzleChain() {
  const [question, setQuestion] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [gradingError, setGradingError] = useState(null);
  const [lockdown, setLockdown] = useState(null);

  const [chainLength, setChainLength] = useState(0); // correct answers in the CURRENT chain
  const [chainScore, setChainScore] = useState(0);
  const [bestChain, setBestChain] = useState(0); // session-local high score, like Quiz Arcade's round score -- not persisted server-side
  const [chainBroken, setChainBroken] = useState(false);

  const loadPuzzle = useCallback((tier) => {
    setLoading(true);
    setLoadError(null);
    setGradingError(null);
    setLockdown(null);
    setResult(null);
    setSelectedIndex(null);
    fetch(`/api/mcq?subjectId=${encodeURIComponent(SUBJECT_ID)}&difficultyTier=${tier}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "locked_down") setLockdown(data);
        else if (data.error) setLoadError(data.error);
        else setQuestion(data);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPuzzle(1);
  }, [loadPuzzle]);

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
        if (data.error === "locked_down") {
          setLockdown(data);
          return;
        }
        if (data.error) {
          setGradingError(data.error);
          return;
        }
        setResult(data);
        if (data.correct) {
          const tierJustAnswered = tierForChainLength(chainLength);
          setChainLength((c) => c + 1);
          setChainScore((s) => s + POINTS_PER_TIER[tierJustAnswered]);
        } else {
          setChainBroken(true);
          setBestChain((b) => Math.max(b, chainLength));
        }
      })
      .catch((e) => setGradingError(e.message))
      .finally(() => setGrading(false));
  }

  function nextPuzzle() {
    loadPuzzle(tierForChainLength(chainLength));
  }

  function startNewChain() {
    setChainLength(0);
    setChainScore(0);
    setChainBroken(false);
    loadPuzzle(1);
  }

  if (loading) return <div className="loading">Preparing your next puzzle…</div>;

  if (lockdown) return <LockdownNotice lockdown={lockdown} />;

  if (loadError)
    return (
      <div className="error-box">
        {loadError}
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => loadPuzzle(tierForChainLength(chainLength))}>
            Try again
          </button>
        </div>
      </div>
    );

  if (!question) return null;

  const currentTier = tierForChainLength(chainLength);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          🔗 Chain: <b>{chainLength}</b> · score <b>{chainScore}</b> · tier {currentTier}
        </span>
        {bestChain > 0 && <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Best this session: {bestChain}</span>}
      </div>

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

        {result && !chainBroken && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontWeight: 700, color: "var(--forest)" }}>Correct! +{POINTS_PER_TIER[currentTier]} · chain now {chainLength}</p>
            {question.options.map((opt, i) => (
              <div
                key={i}
                style={{
                  padding: "7px 12px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: "1px solid var(--rule)",
                  background: i === result.correctIndex ? "#dcebe0" : "var(--ivory-2)",
                  fontSize: 13.5,
                }}
              >
                <b>{OPTION_LETTER[i]}.</b> {opt}
              </div>
            ))}
            {result.explanation && <p style={{ fontSize: 13.5, marginTop: 8 }}>{result.explanation}</p>}
            <button className="btn btn-primary" onClick={nextPuzzle} style={{ marginTop: 8 }}>
              Next puzzle →
            </button>
          </div>
        )}

        {result && chainBroken && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontWeight: 700, color: "var(--maroon)" }}>
              Chain broken! The correct answer was {OPTION_LETTER[result.correctIndex]}. Final chain: {chainLength} · score {chainScore}.
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
            <button className="btn btn-primary" onClick={startNewChain} style={{ marginTop: 8 }}>
              Start a new chain →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
