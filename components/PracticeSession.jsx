"use client";

import { useEffect, useState, useCallback } from "react";

const SOURCE_LABEL = { pyq: "Real PYQ", model: "Model question", generate: "Generating…" };

export default function PracticeSession({ forcedSubtopicId, subtopicLabel }) {
  const [question, setQuestion] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [masteryAfter, setMasteryAfter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState(null);

  const loadNext = useCallback(() => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setAnswerText("");
    const qs = forcedSubtopicId ? `?subtopicId=${encodeURIComponent(forcedSubtopicId)}` : "";
    fetch(`/api/attempt${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setQuestion(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [forcedSubtopicId]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  function submitAnswer() {
    if (!question || !answerText.trim()) return;
    setGrading(true);
    setError(null);
    fetch("/api/attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subtopicId: question.subtopicId,
        questionSource: question.questionSource,
        questionRefId: question.questionRefId,
        questionTextSnapshot: question.questionText,
        difficultyTier: question.tier,
        marks: question.marks,
        answerText,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setFeedback(data.feedback);
          setMasteryAfter(data.mastery);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setGrading(false));
  }

  if (loading) return <div className="loading">Picking your next question…</div>;
  if (error)
    return (
      <div className="error-box">
        {error}
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
      <h1>{subtopicLabel ? subtopicLabel : "Adaptive practice"}</h1>
      <p className="lede">
        One question at a time — your answer shapes the next one. Feedback is a practice aid from an AI grader,
        not an authoritative UPSC score.
      </p>

      <div className="card">
        <div className="meta-line">
          {question.subtopicId} · {question.subtopicText} · tier {question.tier} · {question.marks} marks ·{" "}
          {SOURCE_LABEL[question.questionSource] || question.questionSource}
        </div>

        {question.questionSource === "pyq" && question.pyqYear && (
          <div style={{ marginBottom: 8 }}>
            <span
              style={{
                display: "inline-block",
                fontWeight: 700,
                fontSize: 12.5,
                padding: "2px 8px",
                borderRadius: 6,
                background: "var(--rule)",
              }}
            >
              {question.pyqYear} Q{question.pyqSlot}
              {question.pyqSub}
            </span>
            {question.linkedModuleIndex != null && (
              <a
                href={`/learn/${encodeURIComponent(question.subtopicId)}?module=${question.linkedModuleIndex}`}
                style={{ marginLeft: 10, fontSize: 12.5 }}
              >
                Study this as a module →
              </a>
            )}
          </div>
        )}

        <div className="question-text">{question.questionText}</div>

        {!feedback && (
          <>
            <textarea
              className="answer-box"
              placeholder="Write your answer here…"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={grading}
            />
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={submitAnswer} disabled={grading || !answerText.trim()}>
                {grading ? "Grading…" : "Submit answer"}
              </button>
            </div>
          </>
        )}

        {feedback && (
          <div style={{ marginTop: 10 }}>
            <div className="feedback-score">{feedback.score}/100</div>
            <p>{feedback.verdict}</p>

            {feedback.strengths?.length > 0 && (
              <>
                <strong>Strengths</strong>
                <ul className="feedback-list strong">
                  {feedback.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}

            {feedback.weaknesses?.length > 0 && (
              <>
                <strong>Weaknesses</strong>
                <ul className="feedback-list weak">
                  {feedback.weaknesses.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}

            {feedback.missedProvisions?.length > 0 && (
              <>
                <strong>Worth checking</strong>
                <ul className="feedback-list">
                  {feedback.missedProvisions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}

            {masteryAfter && (
              <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                Subtopic mastery now {Math.round(masteryAfter.score * 100)}% · tier {masteryAfter.tier} ·{" "}
                {masteryAfter.attemptsCount} attempt{masteryAfter.attemptsCount === 1 ? "" : "s"} recorded
              </p>
            )}

            <button className="btn btn-primary" onClick={loadNext} style={{ marginTop: 8 }}>
              Next question →
            </button>
          </div>
        )}

        <div className="disclaimer">
          AI-graded feedback can be wrong, especially on exact citations — the "worth checking" list flags what
          the grader wasn't itself confident about. Cross-check anything you plan to use in a real answer.
        </div>
      </div>
    </>
  );
}
