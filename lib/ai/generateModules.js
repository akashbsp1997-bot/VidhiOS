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
// Grasp+Remember call instead of two practice calls plus an image call, no
// image/visualOutline phase at all. This keeps a subtopic's AI-call total
// (now multiplied by however many modules it has) from growing as fast as
// straight per-module parity with generateLesson.js's shapes would.

import { callClaudeForJSON } from "./client.js";
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

function buildModuleTeachSystem(subjectConfig) {
  return `You are writing a short, focused explanation of ONE narrow sub-concept (a "module") within a larger ${subjectConfig.examLabel} syllabus subtopic, for a self-study aspirant. Stay strictly within the module's stated scope -- the broader subtopic's other angles are covered by other modules, not this one.
Ground every claim ONLY in material you are highly confident is accurate. ${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "teachContent": "<300-500 word focused explanation of just this module's scope, connected prose in paragraphs separated by \\n\\n, not bullet fragments>",
  "keyPoints": [ "<a short, self-contained factual point worth remembering from this module. HARD CAP: 30 words.>" ]
}
Provide 3-5 keyPoints. Every field has a hard word/count cap stated above -- stop well before it, do not pad to fill it.`;
}

function buildModuleTeachUserPrompt({ subtopicText, moduleTitle, moduleScope }) {
  return `Subtopic: ${subtopicText}
Module: "${moduleTitle}" -- ${moduleScope}

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

function buildModulePracticeUserPrompt({ subtopicText, moduleTitle, moduleScope, teachContent }) {
  return `Subtopic: ${subtopicText}
Module: "${moduleTitle}" -- ${moduleScope}

This module's explanation already written:
"""
${teachContent}
"""

Write the practice material and mnemonic now, staying strictly within this module's scope. Return only the JSON object.`;
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

/** Phase 0 -- runs once per subtopic, when the module flow is first entered and no lesson_modules rows exist yet. */
export async function generateModulePlan({ subtopicText, sourceExcerpts, caseAnchors, subjectConfig }) {
  const raw = await callClaudeForJSON({
    system: buildPlanSystem(subjectConfig),
    user: buildPlanUserPrompt({ subtopicText, sourceExcerpts, caseAnchors }),
    maxTokens: 1200,
  });
  return normalizeModulePlanResult(raw);
}

/** Phase 1 (per module) -- runs on first Teach visit to this module. */
export async function generateModuleTeach({ subtopicText, moduleTitle, moduleScope, subjectConfig }) {
  const raw = await callClaudeForJSON({
    system: buildModuleTeachSystem(subjectConfig),
    user: buildModuleTeachUserPrompt({ subtopicText, moduleTitle, moduleScope }),
    maxTokens: 2500,
  });
  return normalizeModuleTeachResult(raw);
}

/** Phase 2 (per module) -- runs on first Grasp visit to this module; also satisfies Remember (no separate image phase). */
export async function generateModulePractice({ subtopicText, moduleTitle, moduleScope, teachContent, subjectConfig }) {
  const raw = await callClaudeForJSON({
    system: buildModulePracticeSystem(subjectConfig),
    user: buildModulePracticeUserPrompt({ subtopicText, moduleTitle, moduleScope, teachContent }),
    maxTokens: 3000,
  });
  return normalizeModulePracticeResult(raw);
}
