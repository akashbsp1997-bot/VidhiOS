"use client";

import { useEffect, useState, useCallback } from "react";
import LockdownNotice from "./LockdownNotice.jsx";
import { PASSING_SCORE_PCT } from "../lib/adaptive/scoring.js";

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Essay Tournament: the third per-content-area game (after Quiz Arcade and
// Quant Puzzle Chain), and a genuinely different mechanic again -- not a
// timer (writing a real 1000-1200 word essay takes real time, a countdown
// would just be hostile) and not an escalating-difficulty chain (there's no
// difficulty tiering for essay topics). Instead: breadth. Round N forces a
// topic from a category you haven't drawn yet this run (round-robin through
// every real category before any repeat), because a well-rounded UPSC
// candidate has to write competently across Philosophy, Economy,
// Environment, Polity, and more -- not just their one comfortable theme.
// Clear PASSING_SCORE_PCT (see lib/adaptive/scoring.js) to advance; fall
// short and the run ends there. No fixed round count -- like the puzzle
// chain, it's "how far can you go," not a set workout.
export default function EssayTournament() {
  const [categoryOrder, setCategoryOrder] = useState(null); // shuffled once per tournament run
  const [topicsByCategory, setTopicsByCategory] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [lockdown, setLockdown] = useState(null);

  const [round, setRound] = useState(1); // 1-based
  const [topic, setTopic] = useState(null);
  const [guide, setGuide] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [essayText, setEssayText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [eliminated, setEliminated] = useState(false);
  const [bestRoundsCleared, setBestRoundsCleared] = useState(0); // session-local, like the other games' round score

  const startTournament = useCallback((categories, byCategory) => {
    const order = shuffle(categories);
    setCategoryOrder(order);
    setTopicsByCategory(byCategory);
    setRound(1);
    setEliminated(false);
    setResult(null);
    setGuide(null);
    setShowGuide(false);
    setEssayText("");
    const pool = byCategory[order[0]];
    setTopic(pool[Math.floor(Math.random() * pool.length)]);
  }, []);

  useEffect(() => {
    fetch("/api/essay-topics")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        const byCategory = Object.fromEntries(data.categories.map((c) => [c.category, c.topics]));
        startTournament(data.categories.map((c) => c.category), byCategory);
      })
      .catch((e) => setLoadError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadGuide() {
    if (guide) {
      setShowGuide((s) => !s);
      return;
    }
    setGuideLoading(true);
    fetch(`/api/essay-guide?topicId=${encodeURIComponent(topic.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error === "locked_down") setLockdown(d);
        else if (!d.error) {
          setGuide(d);
          setShowGuide(true);
        }
      })
      .finally(() => setGuideLoading(false));
  }

  function submitEssay() {
    setSubmitting(true);
    fetch("/api/essay-attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId: topic.id, essayText }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error === "locked_down") {
          setLockdown(d);
          return;
        }
        if (d.error) {
          setLoadError(d.error);
          return;
        }
        setResult(d.feedback);
        if (d.feedback.score < PASSING_SCORE_PCT) {
          setEliminated(true);
          setBestRoundsCleared((b) => Math.max(b, round - 1));
        }
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setSubmitting(false));
  }

  function nextRound() {
    const nextRoundNum = round + 1;
    const category = categoryOrder[(nextRoundNum - 1) % categoryOrder.length];
    const pool = topicsByCategory[category];
    setRound(nextRoundNum);
    setTopic(pool[Math.floor(Math.random() * pool.length)]);
    setGuide(null);
    setShowGuide(false);
    setEssayText("");
    setResult(null);
  }

  function restart() {
    startTournament(categoryOrder, topicsByCategory);
  }

  if (lockdown) return <LockdownNotice lockdown={lockdown} />;
  if (loadError) return <div className="error-box">{loadError}</div>;
  if (!topic) return <div className="loading">Preparing your tournament…</div>;

  const words = wordCount(essayText);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          🏆 Round {round} · cleared so far: <b>{round - 1}</b> · needs {PASSING_SCORE_PCT}%+ to advance
        </span>
        {bestRoundsCleared > 0 && <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Best this session: {bestRoundsCleared} rounds</span>}
      </div>

      <div className="card">
        <div className="meta-line">
          {topic.category} · {topic.source === "pyq" ? `Real UPSC topic, ${topic.year}` : "Practice topic (not a real past paper)"}
        </div>
        <div className="question-text">{topic.topicText}</div>

        {!result && (
          <>
            <button className="btn" onClick={loadGuide} disabled={guideLoading} style={{ marginTop: 10 }}>
              {guideLoading ? "Loading guide…" : showGuide ? "Hide planning guide" : "View planning guide"}
            </button>

            {showGuide && guide && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--ivory-2)", borderRadius: 8, fontSize: 13.5 }}>
                <p>{guide.approachNotes}</p>
                {guide.keyDimensions.length > 0 && (
                  <>
                    <strong>Angles to consider</strong>
                    <ul>
                      {guide.keyDimensions.map((d, i) => (
                        <li key={i}>
                          <b>{d.dimension}:</b> {d.points}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <textarea
              className="answer-box"
              placeholder="Write your full essay here — aim for 1000-1200 words…"
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              style={{ minHeight: 320, marginTop: 14 }}
              disabled={submitting}
            />
            <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>{words} words</p>

            <button className="btn btn-primary" onClick={submitEssay} disabled={submitting || !essayText.trim()}>
              {submitting ? "Grading…" : "Submit essay"}
            </button>
          </>
        )}

        {result && (
          <div style={{ marginTop: 10 }}>
            <div className="feedback-score">{result.score}/100</div>
            <p style={{ fontWeight: 700, color: eliminated ? "var(--maroon)" : "var(--forest)" }}>
              {eliminated ? `Eliminated — needed ${PASSING_SCORE_PCT}%+ to advance. Cleared ${round - 1} round${round - 1 === 1 ? "" : "s"}.` : `Cleared round ${round}! On to round ${round + 1} (${categoryOrder[round % categoryOrder.length]}).`}
            </p>
            <p>{result.verdict}</p>

            {result.strengths?.length > 0 && (
              <>
                <strong>Strengths</strong>
                <ul className="feedback-list strong">
                  {result.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {result.weaknesses?.length > 0 && (
              <>
                <strong>Weaknesses</strong>
                <ul className="feedback-list weak">
                  {result.weaknesses.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {result.missingDimensions?.length > 0 && (
              <>
                <strong>Angles you could have covered</strong>
                <ul className="feedback-list">
                  {result.missingDimensions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}

            <button className="btn btn-primary" onClick={eliminated ? restart : nextRound} style={{ marginTop: 10 }}>
              {eliminated ? "Start a new tournament →" : "Next round →"}
            </button>

            <div className="disclaimer">
              AI-graded feedback can be wrong, especially on multi-dimensionality judgment calls — treat it as a
              practice aid, not an authoritative UPSC score.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
