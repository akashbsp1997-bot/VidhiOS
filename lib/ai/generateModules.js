// lib/ai/generateModules.js
//
// Module-level content: a subtopic decomposed into independently
// teachable/practiceable/testable sub-concepts (see generateModulePlan),
// each of which gets its own full Teach -> Grasp -> Remember -> Test cycle
// via app/api/module-lesson/route.js -- unlike lib/ai/generateLesson.js,
// which generates one cycle covering the WHOLE subtopic (kept alive as the
// legacy flow for subtopics that already have a complete lessons row).
//
// Deliberately lighter than generateLesson.js's shapes throughout: flat
// keyPoints instead of structured keyProvisions/caseLaw, one combined
// practice call instead of two, and a flat title+keyPoints image prompt
// instead of a nested visualOutline tree (a module is already a narrow
// single concept, so it doesn't need one). Still has its own image phase
// (see generateModuleImage) -- reintroduced after initially being cut for
// cost, at the user's request.

import { callClaudeForJSON, callImageGen } from "./client.js";
import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

function buildPlanSystem(subjectConfig) {
  return `You break one UPSC syllabus subtopic into 2-5 independently teachable, practiceable, and testable sub-concepts ("modules") for a ${subjectConfig.examLabel} aspirant, ordered from basics to problem-solving/application. Each module must be a coherent unit someone could be taught, given practice on, and asked an exam-style question about ON ITS OWN -- not a content-type grouping like "definitions" or "case law" (those aren't independently testable).
${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "modules": [
    { "title": "<short module title, max 10 words>", "scopeNote": "<1-2 sentences narrowing exactly what this module covers and does NOT cover, so later prompts about just this module stay in scope>" }
  ]
}
Provide 2-5 modules, ordered from foundational to more advanced/applied. Do not overlap module scopes.`;
}

function buildPlanUserPrompt({ subtopicText, sourceExcerpts, caseAnchors }) {
  const grounding = sourceExcerpts && sourceExcerpts.length
    ? `\n\nReal source material for this subtopic, for grounding (do not quote at length):\n"""\n${sourceExcerpts.join("\n---\n").slice(0, 6000)}\n"""`
    : "";
  const anchors = caseAnchors && caseAnchors.length
    ? `\n\nVerified cases known to be relevant to this subtopic:\n${caseAnchors.map((c) => `- ${c.case}: ${c.point}`).join("\n")}`
    : "";
  return `Subtopic: ${subtopicText}${grounding}${anchors}\n\nDecompose this subtopic into modules now. Return only the JSON object.`;
}

// Used instead of buildPlanSystem/buildPlanUserPrompt whenever a subtopic has
// >=2 real PYQs (see app/api/module-lesson/route.js's threshold/selection
// logic) -- a genuinely different task from free decomposition: the AI is
// summarizing N already-fixed real questions into modules, not inventing
// sub-concepts from general knowledge. Kept as separate functions rather
// than branching inside the free-decomposition ones since the two prompts'
// instructions don't share much beyond the JSON shape.
function buildPyqAnchoredPlanSystem(subjectConfig) {
  return `You are given a list of real past-exam questions (PYQs) for one ${subjectConfig.examLabel} syllabus subtopic. For EACH question, write a concise module title and a scope note describing what a student must learn to answer that specific question well.
${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "modules": [
    { "title": "<short module title summarizing what this question tests, max 10 words>", "scopeNote": "<1-2 sentences: what a student needs to know/be able to do to answer THIS question well>" }
  ]
}
Return exactly one entry per question, in the SAME ORDER as given below -- do not skip, merge, or reorder any.`;
}

function buildPyqAnchoredPlanUserPrompt({ subtopicText, pyqCandidates }) {
  const list = pyqCandidates.map((q, i) => `${i + 1}. (${q.marks} marks) ${q.questionText}`).join("\n");
  return `Subtopic: ${subtopicText}

Real past-exam questions for this subtopic, in order:
${list}

Write one module title + scope note per question above, in the same order. Return only the JSON object.`;
}

function buildModuleTeachSystem(subjectConfig) {
  return `You are writing a short, focused explanation of ONE narrow sub-concept (a "module") within a larger ${subjectConfig.examLabel} syllabus subtopic, for a self-study aspirant. Stay strictly within the module's stated scope -- the broader subtopic's other angles are covered by other modules, not this one.
Ground every claim ONLY in material you are highly confident is accurate. ${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "teachContent": "<300-500 words of this module's explanation as a BULLETED list, not connected prose -- one clear, self-contained point per line, each line starting with '- ', separated by \\n (a single newline, not \\n\\n). Cover what the concept is, its basis, how it works/developed, and why it matters, broken into scannable points a student can revise quickly rather than a paragraph they have to read start to finish.>",
  "keyPoints": [ "<a short, self-contained factual point worth remembering from this module. HARD CAP: 30 words.>" ]
}
Provide 3-5 keyPoints. Every field has a hard word/count cap stated above -- stop well before it, do not pad to fill it.`;
}

function buildModuleTeachUserPrompt({ subtopicText, moduleTitle, moduleScope, pyqQuestionText }) {
  // Lighter anti-leak instruction than practice's below -- teachContent is
  // explanatory prose, not a question, so the main risk is smaller (the
  // student seeing the real Test question rendered inline in Teach), but
  // still worth explicitly guarding against.
  const anchor = pyqQuestionText
    ? `\n\nWrite the explanation so a student who reads it could then answer this real exam question: "${pyqQuestionText}" -- but do not quote or restate the question itself in the explanation.`
    : "";
  return `Subtopic: ${subtopicText}
Module: "${moduleTitle}" -- ${moduleScope}${anchor}

Write this module's explanation now, staying strictly within its scope. Return only the JSON object.`;
}

function buildModulePracticeSystem(subjectConfig) {
  return `You are writing practice material and a memory aid for ONE narrow sub-concept (a "module") within a larger ${subjectConfig.examLabel} syllabus subtopic. You will be given the module's own explanation already written -- build on it, stay consistent with it, do not stray outside the module's scope into the rest of the subtopic.
Ground every claim ONLY in the module explanation given to you or material you are highly confident is accurate. ${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "examples": [
    { "title": "<short label, max 8 words>", "body": "<a worked example or illustration applying just this module's concept. HARD CAP: 50 words.>" }
  ],
  "exercises": [
    { "prompt": "<a short question or scenario testing just this module's concept. HARD CAP: 35 words.>", "hint": "<a one-line nudge, not the answer. HARD CAP: 15 words.>", "modelAnswer": "<a concise model answer. HARD CAP: 60 words.>" }
  ],
  "mnemonic": { "device": "<one mnemonic device for this module -- acronym, phrase, or memory device>", "explanation": "<what it maps to. HARD CAP: 35 words.>" }
}
Provide 1-2 examples, 1-2 exercises, and exactly one mnemonic. Every field has a hard word cap stated above -- stop well before it, do not pad to fill it.`;
}

function buildModulePracticeUserPrompt({ subtopicText, moduleTitle, moduleScope, teachContent, pyqQuestionText }) {
  // Hard anti-leak instruction, not optional -- without it, an AI grounded
  // in the real Test question tends to write an exercise that IS that
  // question (or a close paraphrase) plus a model answer, which means the
  // student sees the real Test question answered for them during Grasp,
  // then is asked to answer it "cold" during Test. That doesn't just weaken
  // Test, it eliminates it as an assessment.
  const anchor = pyqQuestionText
    ? `\n\nThis module's Test will separately ask the student EXACTLY this real past exam question (verbatim):\n"""\n${pyqQuestionText}\n"""\nDo NOT include this question, or a close paraphrase of it, among the exercises below -- write DIFFERENT illustrative examples/exercises that build the skills needed to answer it, not the question itself.`
    : "";
  return `Subtopic: ${subtopicText}
Module: "${moduleTitle}" -- ${moduleScope}

This module's explanation already written:
"""
${teachContent}
"""${anchor}

Write the practice material and mnemonic now, staying strictly within this module's scope. Return only the JSON object.`;
}

// Flat prompt from title+keyPoints rather than lib/ai/generateLesson.js's
// nested visualOutline tree -- a module is already one narrow concept, so
// its keyPoints (3-6 short bullets) are enough boxes for a simple diagram
// without needing a hierarchy to flatten first.
function buildModuleImagePrompt(moduleTitle, keyPoints) {
  const labels = (keyPoints || []).slice(0, 6);
  return `Create a simple, clean educational diagram (flat infographic style, plain background, no photorealism) illustrating the concept "${moduleTitle}".
Structure it as a small hierarchy or flowchart using ONLY these short labels, spelled EXACTLY as given, one per box, large and clearly legible: ${labels.map((l) => `"${l}"`).join(", ")}.
Do not add any other text, numbers, citations, or labels beyond these -- keep every label short and the layout uncluttered. This is a memory aid, not a data-dense chart.`;
}

export function normalizeModulePlanResult(raw) {
  const modules = Array.isArray(raw?.modules)
    ? raw.modules
        .filter((m) => m && typeof m.title === "string" && m.title.trim())
        .slice(0, 5)
        .map((m) => ({
          title: m.title.trim().slice(0, 120),
          scopeNote: typeof m.scopeNote === "string" ? m.scopeNote.trim().slice(0, 500) : "",
        }))
    : [];
  if (!modules.length) {
    throw new Error("Model did not return usable modules");
  }
  return modules;
}

// Deliberately NOT reusing normalizeModulePlanResult's .filter() -- that
// would silently misalign a later PYQ's title to an earlier PYQ's pyqId the
// moment the AI returns a short/malformed entry (filtering shifts every
// subsequent index). This iterates pyqCandidates (the real, trusted data),
// not raw.modules, and falls back to a deterministic title per-entry
// instead of throwing -- safe because real PYQ data is always available as
// a title fallback here, unlike the free-decomposition path.
export function normalizeModulePlanFromPyqsResult(raw, pyqCandidates) {
  const entries = Array.isArray(raw?.modules) ? raw.modules : [];
  return pyqCandidates.map((pyq, i) => {
    const entry = entries[i];
    const title = typeof entry?.title === "string" && entry.title.trim() ? entry.title.trim().slice(0, 120) : `PYQ ${pyq.year} Q${pyq.slot}${pyq.sub}`;
    const scopeNote = typeof entry?.scopeNote === "string" ? entry.scopeNote.trim().slice(0, 500) : "";
    return { title, scopeNote, pyqId: pyq.id };
  });
}

export function normalizeModuleTeachResult(raw) {
  const teachContent = typeof raw?.teachContent === "string" ? raw.teachContent.trim() : "";
  if (!teachContent) {
    throw new Error("Model did not return usable teachContent");
  }
  const keyPoints = Array.isArray(raw?.keyPoints)
    ? raw.keyPoints.filter((p) => typeof p === "string" && p.trim()).slice(0, 6).map((p) => p.trim().slice(0, 200))
    : [];
  return { teachContent: teachContent.slice(0, 4000), keyPoints };
}

export function normalizeModulePracticeResult(raw) {
  const examples = Array.isArray(raw?.examples)
    ? raw.examples
        .filter((e) => e && typeof e.title === "string" && typeof e.body === "string")
        .slice(0, 2)
        .map((e) => ({ title: e.title.slice(0, 120), body: e.body.slice(0, 600) }))
    : [];

  const exercises = Array.isArray(raw?.exercises)
    ? raw.exercises
        .filter((e) => e && typeof e.prompt === "string")
        .slice(0, 2)
        .map((e) => ({
          prompt: e.prompt.slice(0, 400),
          hint: typeof e.hint === "string" ? e.hint.slice(0, 200) : "",
          modelAnswer: typeof e.modelAnswer === "string" ? e.modelAnswer.slice(0, 700) : "",
        }))
    : [];

  const mnemonic =
    raw?.mnemonic && typeof raw.mnemonic.device === "string"
      ? { device: raw.mnemonic.device.slice(0, 300), explanation: typeof raw.mnemonic.explanation === "string" ? raw.mnemonic.explanation.slice(0, 400) : "" }
      : null;

  return { examples, exercises, mnemonic };
}

/**
 * Phase 0 (fallback) -- runs once per subtopic when the module flow is
 * first entered, no lesson_modules rows exist yet, AND the subtopic has
 * fewer than 2 real PYQs (see app/api/module-lesson/route.js's threshold).
 */
export async function generateModulePlan({ subtopicText, sourceExcerpts, caseAnchors, subjectConfig }) {
  const raw = await callClaudeForJSON({
    system: buildPlanSystem(subjectConfig),
    user: buildPlanUserPrompt({ subtopicText, sourceExcerpts, caseAnchors }),
    maxTokens: 1200,
  });
  return normalizeModulePlanResult(raw);
}

/**
 * Phase 0 (PYQ-anchored) -- the preferred path, used whenever the subtopic
 * has >=2 real PYQs. `pyqCandidates` is already selected/ordered by the
 * caller (year-desc selection, then re-sorted marks-ascending for
 * foundational-to-advanced presentation order) -- this function's job is
 * purely "summarize these real questions into modules," not selection.
 */
export async function generateModulePlanFromPyqs({ subtopicText, pyqCandidates, subjectConfig }) {
  const raw = await callClaudeForJSON({
    system: buildPyqAnchoredPlanSystem(subjectConfig),
    user: buildPyqAnchoredPlanUserPrompt({ subtopicText, pyqCandidates }),
    maxTokens: 1200,
  });
  return normalizeModulePlanFromPyqsResult(raw, pyqCandidates);
}

/**
 * Phase 1 (per module) -- runs on first Teach visit to this module.
 * `pyqQuestionText` is only passed for a PYQ-anchored module (see
 * app/api/module-lesson/route.js) -- grounds the explanation in the real
 * question without quoting it.
 */
export async function generateModuleTeach({ subtopicText, moduleTitle, moduleScope, pyqQuestionText, subjectConfig }) {
  const raw = await callClaudeForJSON({
    system: buildModuleTeachSystem(subjectConfig),
    user: buildModuleTeachUserPrompt({ subtopicText, moduleTitle, moduleScope, pyqQuestionText }),
    maxTokens: 2500,
  });
  return normalizeModuleTeachResult(raw);
}

/**
 * Phase 2 (per module) -- runs on first Grasp visit to this module; also
 * satisfies Remember (no separate image phase). `pyqQuestionText`, when
 * present, triggers the hard anti-leak instruction in
 * buildModulePracticeUserPrompt so practice material doesn't give away the
 * module's Test question.
 */
export async function generateModulePractice({ subtopicText, moduleTitle, moduleScope, teachContent, pyqQuestionText, subjectConfig }) {
  const raw = await callClaudeForJSON({
    system: buildModulePracticeSystem(subjectConfig),
    user: buildModulePracticeUserPrompt({ subtopicText, moduleTitle, moduleScope, teachContent, pyqQuestionText }),
    maxTokens: 3000,
  });
  return normalizeModulePracticeResult(raw);
}

/** Phase 3 (per module) -- runs on first Remember visit. Non-fatal on failure, same as generateLesson.js's generateLessonImage. */
export async function generateModuleImage({ moduleTitle, keyPoints }) {
  try {
    return await callImageGen({ prompt: buildModuleImagePrompt(moduleTitle, keyPoints) });
  } catch (err) {
    console.error(`Module image generation failed for "${moduleTitle}":`, err.message);
    return null;
  }
}
