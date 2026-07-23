"use client";

import { useEffect, useState } from "react";
import PracticeSession from "./PracticeSession.jsx";
import LockdownNotice from "./LockdownNotice.jsx";

// The pre-module-system Teach/Grasp/Remember/Test flow (one AI-generated
// lesson covering the WHOLE subtopic, via app/api/lesson/route.js and the
// `lessons` table), moved here verbatim from app/learn/[subtopicId]/page.jsx
// and kept alive as-is for any subtopic that already has a complete lesson
// generated this way -- converting that content into the new per-module
// shape isn't a safe automatic migration (see drizzle/0007's comment), so
// this stays the real, working experience for those subtopics rather than
// being deleted. New/untouched subtopics go straight to ModuleLearnFlow.jsx
// instead; see app/learn/[subtopicId]/page.jsx for the dispatch logic.

const STAGES = [
  { key: "teach", label: "Teach" },
  { key: "grasp", label: "Grasp" },
  { key: "remember", label: "Remember" },
  { key: "test", label: "Test" },
];

const MAX_STAGE_FETCH_ITERATIONS = 5;

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

function StageModules({ modules, moduleIndex, setModuleIndex, onComplete, completeLabel }) {
  if (modules.length === 0) return null;
  const index = Math.min(moduleIndex, modules.length - 1);
  const current = modules[index];
  const isLast = index === modules.length - 1;

  return (
    <>
      <div className="module-progress" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
          {current.label} · {index + 1} of {modules.length}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {modules.map((m, i) => (
            <span
              key={m.key}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: i === index ? "var(--ink)" : "var(--rule)",
              }}
            />
          ))}
        </div>
      </div>

      {current.node}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {index > 0 && (
          <button className="btn" onClick={() => setModuleIndex(index - 1)}>
            ← Back
          </button>
        )}
        {!isLast ? (
          <button className="btn btn-primary" onClick={() => setModuleIndex(index + 1)}>
            Next: {modules[index + 1].label} →
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onComplete}>
            {completeLabel}
          </button>
        )}
      </div>
    </>
  );
}

export default function LegacyLearnFlow({ subtopicId, onUpgrade, upgrading }) {
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [lockdown, setLockdown] = useState(null);
  const [stage, setStage] = useState("teach");
  const [loadingStage, setLoadingStage] = useState(null);
  const [moduleIndex, setModuleIndex] = useState(0);

  async function ensureStageReady(stageKey, force = false) {
    setLoadingStage(stageKey);
    try {
      for (let i = 0; i < MAX_STAGE_FETCH_ITERATIONS; i++) {
        const url = `/api/lesson?subtopicId=${encodeURIComponent(subtopicId)}&stage=${stageKey}${force && i === 0 ? "&force=true" : ""}`;
        const data = await safeFetchJson(url);
        if (data.error === "locked_down") {
          setLockdown(data);
          return;
        }
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
    setLockdown(null);
    setStage("teach");
    setModuleIndex(0);
    ensureStageReady("teach");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtopicId]);

  function goToStage(next) {
    setStage(next);
    setModuleIndex(0);
    fetch("/api/lesson", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtopicId, stage: next }),
    }).catch(() => {});
    ensureStageReady(next);
  }

  if (lockdown) return <LockdownNotice lockdown={lockdown} />;
  if (error) return <div className="error-box">{error}</div>;
  if (!lesson) return <div className="loading">{"Preparing this lesson… (first visit generates it, a few seconds)"}</div>;

  const practiceReady = Boolean(lesson.practiceGeneratedAt);

  const teachModules = [
    {
      key: "concept",
      label: "Concept",
      node: lesson.teachContent.split("\n\n").map((para, i) => (
        <p key={i} style={{ fontSize: 14.5, lineHeight: 1.6 }}>
          {para}
        </p>
      )),
    },
    lesson.keyProvisions?.length > 0 && {
      key: "provisions",
      label: "Key provisions",
      node: lesson.keyProvisions.map((p, i) => (
        <div className="provision-card" key={i}>
          <div className="provision-citation">{p.citation}</div>
          <div className="provision-summary">{p.summary}</div>
        </div>
      )),
    },
    lesson.caseLaw?.length > 0 && {
      key: "caselaw",
      label: "Case law",
      node: (
        <>
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
      ),
    },
  ].filter(Boolean);

  const graspModules = practiceReady
    ? [
        {
          key: "examples",
          label: "Examples",
          node: lesson.examples.map((ex, i) => (
            <div className="example-card" key={i}>
              <div className="example-title">{ex.title}</div>
              <div className="example-body">{ex.body}</div>
            </div>
          )),
        },
        {
          key: "exercises",
          label: "Exercises",
          node: (
            <>
              <p className="section-hint" style={{ marginBottom: 10 }}>
                Self-check — think it through, then reveal the model answer. Not graded.
              </p>
              {lesson.exercises.map((ex, i) => (
                <ExerciseCard ex={ex} key={i} />
              ))}
            </>
          ),
        },
        lesson.perspectives?.length > 0 && {
          key: "perspectives",
          label: "Perspectives",
          node: lesson.perspectives.map((p, i) => (
            <div className="example-card" key={i}>
              <div className="example-title">{p.angle}</div>
              <div className="example-body">{p.explanation}</div>
            </div>
          )),
        },
        lesson.answerFramework && {
          key: "framework",
          label: "How to answer this",
          node: <p style={{ fontSize: 14, lineHeight: 1.6 }}>{lesson.answerFramework}</p>,
        },
      ].filter(Boolean)
    : [];

  const rememberModules = practiceReady
    ? [
        {
          key: "mnemonics",
          label: "Mnemonics",
          node: lesson.mnemonics.map((m, i) => (
            <div className="mnemonic-card" key={i}>
              <div className="mnemonic-device">{m.device}</div>
              <div className="mnemonic-explanation">{m.explanation}</div>
            </div>
          )),
        },
        {
          key: "outline",
          label: "Visual outline",
          node: (
            <>
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
            </>
          ),
        },
      ].filter(Boolean)
    : [];

  return (
    <>
      <h1>{lesson.subjectDisplayName ? `${lesson.subjectDisplayName} · ${subtopicId}` : subtopicId}</h1>
      <p className="lede">{lesson.subtopicText}</p>

      {onUpgrade && (
        <div className="disclaimer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span>This subtopic is on the older whole-subtopic lesson format.</span>
          <button className="btn" onClick={onUpgrade} disabled={upgrading}>
            {upgrading ? "Upgrading…" : "Upgrade to modules"}
          </button>
        </div>
      )}

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
          <StageModules
            modules={teachModules}
            moduleIndex={moduleIndex}
            setModuleIndex={setModuleIndex}
            onComplete={() => goToStage("grasp")}
            completeLabel="Continue to Grasp →"
          />
        </div>
      )}

      {stage === "grasp" && (
        <div className="card">
          <h2>Grasp</h2>
          {!practiceReady ? (
            <div className="loading">{"Preparing Grasp content…"}</div>
          ) : (
            <StageModules
              modules={graspModules}
              moduleIndex={moduleIndex}
              setModuleIndex={setModuleIndex}
              onComplete={() => goToStage("remember")}
              completeLabel="Continue to Remember →"
            />
          )}
        </div>
      )}

      {stage === "remember" && (
        <div className="card">
          <h2>Remember</h2>
          {!practiceReady ? (
            <div className="loading">{"Preparing Remember content…"}</div>
          ) : (
            <StageModules
              modules={rememberModules}
              moduleIndex={moduleIndex}
              setModuleIndex={setModuleIndex}
              onComplete={() => goToStage("test")}
              completeLabel="Start Test →"
            />
          )}
        </div>
      )}

      {stage === "test" && <PracticeSession forcedSubtopicId={subtopicId} subtopicLabel={`Testing ${subtopicId}`} />}
    </>
  );
}
