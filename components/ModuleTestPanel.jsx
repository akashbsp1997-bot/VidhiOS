"use client";

import { useEffect, useState } from "react";

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
  const [error, setError] = useState(null);

  useEffect(() => {
    setQuestion(null);
    setAnswerText("");
    setFeedback(null);
    setError(null);
    setLoading(true);
    fetch(`/api/attempt?subtopicId=${encodeURIComponent(subtopicId)}&moduleId=${moduleId}`)
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setQuestion(data)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [subtopicId, moduleId]);

  function submitAnswer() {
    if (!question || !answerText.trim()) return;
    setGrading(true);
    setError(null);
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
      .then((data) => (data.error ? setError(data.error) : setFeedback(data.feedback)))
      .catch((e) => setError(e.message))
      .finally(() => setGrading(false));
  }

  if (loading) return <div className="loading">Preparing this module's question…</div>;
  if (error)
    return (
      <div className="error-box">
        {error}
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
        {moduleTitle} · {question.marks} marks
      </div>
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

          <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 8 }}>
            {isLastModule ? "Finish this subtopic →" : "Next module →"}
          </button>
        </div>
      )}

      <div className="disclaimer">
        AI-graded feedback can be wrong, especially on exact citations — cross-check anything you plan to use in a real answer.
      </div>
    </>
  );
}
