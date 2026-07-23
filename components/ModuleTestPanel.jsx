"use client";

import { useEffect, useState } from "react";
import ModelAnswerPanel from "./ModelAnswerPanel.jsx";

// Same convention as components/PracticeSession.jsx's SOURCE_LABEL.
const SOURCE_LABEL = { pyq: "Real PYQ", model: "Model question" };

// Deliberately NOT PracticeSession -- that component's loadNext/"Next
// question →" loop assumes an unbounded adaptive pool (real PYQs mixed
// with rotating model questions), which doesn't fit this panel's shape:
// exactly one cached, module-scoped question (see
// app/api/attempt/route.js's handleModuleQuestion), answer it once, then
// advance to the next module -- no pool, no retry-a-different-question
// path needed.
export default function ModuleTestPanel({ subtopicId, moduleId, moduleTitle, isLastModule, onNext }) {
  const [question, setQuestion] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  // Two separate error states, deliberately -- a GET failure (no question
  // ever loaded) and a POST/grading failure (question and the student's
  // already-typed answer both still exist, grading just didn't complete)
  // are different situations. A single shared error used to collapse both
  // into the same full-panel "nothing worked, skip this test" view, which
  // meant a transient grading hiccup (e.g. the model provider returning a
  // temporary 503 "high demand") silently discarded whatever the student had
  // just written, with no way to just retry grading it.
  const [loadError, setLoadError] = useState(null);
  const [gradingError, setGradingError] = useState(null);

  useEffect(() => {
    setQuestion(null);
    setAnswerText("");
    setFeedback(null);
    setLoadError(null);
    setGradingError(null);
    setLoading(true);
    fetch(`/api/attempt?subtopicId=${encodeURIComponent(subtopicId)}&moduleId=${moduleId}`)
      .then((r) => r.json())
      .then((data) => (data.error ? setLoadError(data.error) : setQuestion(data)))
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [subtopicId, moduleId]);

  function submitAnswer() {
    if (!question || !answerText.trim()) return;
    setGrading(true);
    setGradingError(null);
    fetch("/api/attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subtopicId,
        moduleId,
        questionSource: question.questionSource,
        questionRefId: question.questionRefId,
        questionTextSnapshot: question.questionText,
        difficultyTier: question.tier,
        marks: question.marks,
        answerText,
      }),
    })
      .then((r) => r.json())
      .then((data) => (data.error ? setGradingError(data.error) : setFeedback(data.feedback)))
      .catch((e) => setGradingError(e.message))
      .finally(() => setGrading(false));
  }

  // For a PYQ-anchored question the text is fixed real content -- retrying
  // is just a local state reset, GET would deterministically re-serve the
  // exact same question anyway. An AI-invented question has no "harder
  // version" of itself, so retrying there means generating a genuinely
  // different one via force=true (see app/api/attempt/route.js's
  // handleModuleQuestion).
  function retryTest() {
    setAnswerText("");
    setFeedback(null);
    setGradingError(null);
    if (question?.questionSource === "pyq") return;
    setLoadError(null);
    setLoading(true);
    fetch(`/api/attempt?subtopicId=${encodeURIComponent(subtopicId)}&moduleId=${moduleId}&force=true`)
      .then((r) => r.json())
      .then((data) => (data.error ? setLoadError(data.error) : setQuestion(data)))
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }

  if (loading) return <div className="loading">Preparing this module's question…</div>;
  if (loadError)
    return (
      <div className="error-box">
        {loadError}
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={onNext}>
            Skip this test
          </button>
        </div>
      </div>
    );
  if (!question) return null;

  return (
    <>
      <div className="meta-line">
        {moduleTitle} · {question.marks} marks · {SOURCE_LABEL[question.questionSource] || question.questionSource}
      </div>
      <div className="question-text">{question.questionText}</div>
      <ModelAnswerPanel subtopicId={subtopicId} questionSource={question.questionSource} questionRefId={question.questionRefId} />

      {!feedback && (
        <>
          <textarea
            className="answer-box"
            placeholder="Write your answer here…"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            disabled={grading}
          />
          {gradingError && (
            <div className="error-box" style={{ marginTop: 10 }}>
              {gradingError}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={submitAnswer} disabled={grading || !answerText.trim()}>
              {grading ? "Grading…" : gradingError ? "Retry grading" : "Submit answer"}
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

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={retryTest}>
              Retry this test
            </button>
            <button className="btn btn-primary" onClick={onNext}>
              {isLastModule ? "Finish this subtopic →" : "Next module →"}
            </button>
          </div>
        </div>
      )}

      <div className="disclaimer">
        AI-graded feedback can be wrong, especially on exact citations — cross-check anything you plan to use in a real answer.
      </div>
    </>
  );
}
