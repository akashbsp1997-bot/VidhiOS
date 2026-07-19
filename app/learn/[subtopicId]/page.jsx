"use client";

import { useEffect, useState, use } from "react";
import PracticeSession from "../../../components/PracticeSession.jsx";

const STAGES = [
  { key: "teach", label: "Teach" },
  { key: "grasp", label: "Grasp" },
  { key: "remember", label: "Remember" },
  { key: "test", label: "Test" },
];

function OutlineNode({ node }) {
  if (!node) return null;
  return (
    <div className="outline-node">
      <div className="outline-label">{node.label}</div>
      {node.children?.length > 0 && (
        <div className="outline-children">
          {node.children.map((c, i) => (
            <OutlineNode node={c} key={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ ex }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="exercise-card">
      <div className="exercise-prompt">{ex.prompt}</div>
      {!revealed ? (
        <button className="btn" style={{ marginTop: 8, padding: "6px 12px", fontSize: 13 }} onClick={() => setRevealed(true)}>
          {ex.hint ? `Hint: ${ex.hint} — show answer` : "Show model answer"}
        </button>
      ) : (
        <div className="exercise-answer">{ex.modelAnswer}</div>
      )}
    </div>
  );
}

export default function LearnPage({ params }) {
  const { subtopicId } = use(params);
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState("teach");

  useEffect(() => {
    setLesson(null);
    setError(null);
    fetch(`/api/lesson?subtopicId=${encodeURIComponent(subtopicId)}`)
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setLesson(data)))
      .catch((e) => setError(e.message));
  }, [subtopicId]);

  function goToStage(next) {
    setStage(next);
    fetch("/api/lesson", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtopicId, stage: next }),
    }).catch(() => {});
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!lesson) return <div className="loading">{"Preparing this lesson\u2026 (first visit generates it, a few seconds)"}</div>;

  return (
    <>
      <h1>{subtopicId}</h1>
      <p className="lede">{lesson.subtopicText}</p>

      <div className="segmented">
        {STAGES.map((s) => (
          <button key={s.key} className={`seg${stage === s.key ? " active" : ""}`} onClick={() => goToStage(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {stage === "teach" && (
        <div className="card">
          <h2>Teach</h2>
          {lesson.teachContent.split("\n\n").map((para, i) => (
            <p key={i} style={{ fontSize: 14.5, lineHeight: 1.6 }}>
              {para}
            </p>
          ))}
          <button className="btn btn-primary" onClick={() => goToStage("grasp")} style={{ marginTop: 10 }}>
            Continue to Grasp →
          </button>
        </div>
      )}

      {stage === "grasp" && (
        <div className="card">
          <h2>Grasp — examples</h2>
          {lesson.examples.map((ex, i) => (
            <div className="example-card" key={i}>
              <div className="example-title">{ex.title}</div>
              <div className="example-body">{ex.body}</div>
            </div>
          ))}
          <h2 style={{ marginTop: 18 }}>Exercises</h2>
          <p className="section-hint" style={{ marginBottom: 10 }}>
            Self-check — think it through, then reveal the model answer. Not graded.
          </p>
          {lesson.exercises.map((ex, i) => (
            <ExerciseCard ex={ex} key={i} />
          ))}
          <button className="btn btn-primary" onClick={() => goToStage("remember")} style={{ marginTop: 10 }}>
            Continue to Remember →
          </button>
        </div>
      )}

      {stage === "remember" && (
        <div className="card">
          <h2>Remember — mnemonics</h2>
          {lesson.mnemonics.map((m, i) => (
            <div className="mnemonic-card" key={i}>
              <div className="mnemonic-device">{m.device}</div>
              <div className="mnemonic-explanation">{m.explanation}</div>
            </div>
          ))}
          <h2 style={{ marginTop: 18 }}>Visual outline</h2>
          <div className="outline-tree">
            <OutlineNode node={lesson.visualOutline} />
          </div>
          <button className="btn btn-primary" onClick={() => goToStage("test")} style={{ marginTop: 14 }}>
            Start Test →
          </button>
        </div>
      )}

      {stage === "test" && <PracticeSession forcedSubtopicId={subtopicId} subtopicLabel={`Testing ${subtopicId}`} />}
    </>
  );
}
