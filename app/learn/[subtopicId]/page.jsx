"use client";

import { useEffect, useState, use } from "react";
import PracticeSession from "../../../components/PracticeSession.jsx";

const STAGES = [
  { key: "teach", label: "Teach" },
  { key: "grasp", label: "Grasp" },
  { key: "remember", label: "Remember" },
  { key: "test", label: "Test" },
];

const MAX_STAGE_FETCH_ITERATIONS = 5;

// A server crash/timeout returns an HTML/plain-text error page, not our
// JSON shape -- reading the body as text first (rather than res.json()
// directly) means a failure like that surfaces its real content instead of
// a bare, unhelpful "Unexpected token... is not valid JSON". Same pattern
// as app/ingest/upload/page.jsx and app/ingest/review/page.jsx.
async function safeFetchJson(url, options) {
  const res = await fetch(url, options);
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Server returned a non-JSON response (HTTP ${res.status}): ${raw.slice(0, 300) || "(empty body)"}`);
  }
}

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
  const [loadingStage, setLoadingStage] = useState(null);

  // Fetches /api/lesson for `stageKey`, re-fetching (same stage) as long as
  // the route reports ready:false -- each individual request runs at most
  // one AI phase (see app/api/lesson/route.js's nextMissingPhase), so a
  // stage needing several not-yet-generated phases (e.g. jumping straight
  // from Teach to Remember, which the segmented nav below doesn't prevent)
  // gets caught up over several fast round-trips instead of one long
  // bundled request. Merges with a functional update so a fetch that
  // resolves after the student navigated elsewhere doesn't clobber newer
  // state.
  async function ensureStageReady(stageKey, force = false) {
    setLoadingStage(stageKey);
    try {
      for (let i = 0; i < MAX_STAGE_FETCH_ITERATIONS; i++) {
        const url = `/api/lesson?subtopicId=${encodeURIComponent(subtopicId)}&stage=${stageKey}${force && i === 0 ? "&force=true" : ""}`;
        const data = await safeFetchJson(url);
        if (data.error) {
          setError(data.error);
          return;
        }
        setLesson((prev) => ({ ...prev, ...data }));
        if (data.ready) return;
      }
      setError("Lesson content is taking longer than expected to prepare. Please try again in a moment.");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingStage((prev) => (prev === stageKey ? null : prev));
    }
  }

  useEffect(() => {
    setLesson(null);
    setError(null);
    setStage("teach");
    ensureStageReady("teach");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtopicId]);

  function goToStage(next) {
    setStage(next);
    fetch("/api/lesson", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtopicId, stage: next }),
    }).catch(() => {});
    ensureStageReady(next);
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!lesson) return <div className="loading">{"Preparing this lesson\u2026 (first visit generates it, a few seconds)"}</div>;

  const practiceReady = Boolean(lesson.practiceGeneratedAt);

  return (
    <>
      <h1>{lesson.subjectDisplayName ? `${lesson.subjectDisplayName} · ${subtopicId}` : subtopicId}</h1>
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

          {lesson.keyProvisions?.length > 0 && (
            <>
              <h2 style={{ marginTop: 18 }}>Key provisions</h2>
              {lesson.keyProvisions.map((p, i) => (
                <div className="provision-card" key={i}>
                  <div className="provision-citation">{p.citation}</div>
                  <div className="provision-summary">{p.summary}</div>
                </div>
              ))}
            </>
          )}

          {lesson.caseLaw?.length > 0 && (
            <>
              <h2 style={{ marginTop: 18 }}>Case law</h2>
              {lesson.caseLaw.map((c, i) => (
                <div className="case-card" key={i}>
                  <div className="case-name">{c.case}</div>
                  {c.facts && (
                    <div className="case-field">
                      <span className="case-field-label">Facts</span> {c.facts}
                    </div>
                  )}
                  {c.holding && (
                    <div className="case-field">
                      <span className="case-field-label">Held</span> {c.holding}
                    </div>
                  )}
                  {c.significance && (
                    <div className="case-field">
                      <span className="case-field-label">Use it for</span> {c.significance}
                    </div>
                  )}
                </div>
              ))}
              <div className="disclaimer">Verify exact citations/years against your own sources before using these in an actual answer.</div>
            </>
          )}

          <button className="btn btn-primary" onClick={() => goToStage("grasp")} style={{ marginTop: 10 }}>
            Continue to Grasp →
          </button>
        </div>
      )}

      {stage === "grasp" && (
        <div className="card">
          <h2>Grasp — examples</h2>
          {!practiceReady ? (
            <div className="loading">{"Preparing Grasp content…"}</div>
          ) : (
            <>
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

              {lesson.perspectives?.length > 0 && (
                <>
                  <h2 style={{ marginTop: 18 }}>Perspectives — for critical/discuss answers</h2>
                  {lesson.perspectives.map((p, i) => (
                    <div className="example-card" key={i}>
                      <div className="example-title">{p.angle}</div>
                      <div className="example-body">{p.explanation}</div>
                    </div>
                  ))}
                </>
              )}

              {lesson.answerFramework && (
                <>
                  <h2 style={{ marginTop: 18 }}>How to answer this</h2>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}>{lesson.answerFramework}</p>
                </>
              )}

              <button className="btn btn-primary" onClick={() => goToStage("remember")} style={{ marginTop: 10 }}>
                Continue to Remember →
              </button>
            </>
          )}
        </div>
      )}


      {stage === "remember" && (
        <div className="card">
          <h2>Remember — mnemonics</h2>
          {!practiceReady ? (
            <div className="loading">{"Preparing Remember content…"}</div>
          ) : (
            <>
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
              {lesson.visualImageDataUri ? (
                <img src={lesson.visualImageDataUri} alt={`Concept diagram for ${subtopicId}`} className="visual-diagram" />
              ) : (
                loadingStage === "remember" && (
                  <p className="section-hint" style={{ marginTop: 10 }}>
                    {"Generating diagram…"}
                  </p>
                )
              )}
              <button className="btn btn-primary" onClick={() => goToStage("test")} style={{ marginTop: 14 }}>
                Start Test →
              </button>
            </>
          )}
        </div>
      )}

      {stage === "test" && <PracticeSession forcedSubtopicId={subtopicId} subtopicLabel={`Testing ${subtopicId}`} />}
    </>
  );
}
