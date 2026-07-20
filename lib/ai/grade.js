// lib/ai/grade.js
//
// Grades one answer against one question. Deliberately narrow: it does not
// try to be an authoritative UPSC-grade examiner (an LLM grading a law essay
// has real accuracy limits — see docs/ARCHITECTURE.md) — it's built to give
// consistent, structured, actionable signal for the adaptive engine and for
// the person reading their own feedback. Surface this framing in the UI too,
// the same way VidhiOS's exam mode disclaims its self-check as mechanical,
// not a content grade.

import { callClaudeForJSON } from "./client.js";

function buildSystem(subjectConfig) {
  const extraFieldsBlock = (subjectConfig.feedbackExtraFields || [])
    .map((f) => `  "${f}": [<0-4 short strings — specific items the answer should have engaged with but didn't; empty array if none>],`)
    .join("\n");

  return `You are grading a ${subjectConfig.examLabel} answer for practice purposes.
Be an exacting but fair examiner: ${subjectConfig.gradingRubricNotes}
You are a practice aid, not the actual UPSC examiner — do not claim more certainty than you have.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "score": <integer 0-100>,
  "strengths": [<1-4 short strings>],
  "weaknesses": [<1-4 short strings>],
${extraFieldsBlock}
  "verdict": "<one or two sentence summary in plain language>"
}`;
}

function buildUserPrompt({ questionText, marks, subtopicText, answerText }) {
  return `Subtopic: ${subtopicText}
Question (${marks} marks): ${questionText}

Candidate's answer:
"""
${answerText}
"""

Grade this answer now. Return only the JSON object.`;
}

/**
 * @returns {Promise<{score:number, strengths:string[], weaknesses:string[], verdict:string, [extraField:string]:string[]}>}
 */
export async function gradeAnswer({ questionText, marks, subtopicText, answerText, subjectConfig }) {
  const extraFields = subjectConfig.feedbackExtraFields || [];

  if (!answerText || !answerText.trim()) {
    // Don't spend an API call grading an empty submission.
    return {
      score: 0,
      strengths: [],
      weaknesses: ["No answer was submitted."],
      ...Object.fromEntries(extraFields.map((f) => [f, []])),
      verdict: "Empty submission.",
    };
  }

  // 2000, not 700 -- see lib/ai/generateQuestion.js's comment on the same
  // change; the current free model needs more headroom than the previous
  // one across every call site, not just the ingest ones where this was
  // first observed live.
  const result = await callClaudeForJSON({
    system: buildSystem(subjectConfig),
    user: buildUserPrompt({ questionText, marks, subtopicText, answerText }),
    maxTokens: 2000,
  });

  return normalizeGradeResult(result, extraFields);
}

/**
 * Clamps/coerces the model's output into a shape the DB/engine can trust,
 * rather than assuming the model followed the schema exactly.
 */
export function normalizeGradeResult(raw, extraFields = []) {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw?.score) || 0)));
  const asStringArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : []);
  return {
    score,
    strengths: asStringArray(raw?.strengths),
    weaknesses: asStringArray(raw?.weaknesses),
    ...Object.fromEntries(extraFields.map((f) => [f, asStringArray(raw?.[f])])),
    verdict: typeof raw?.verdict === "string" ? raw.verdict.slice(0, 500) : "",
  };
}
