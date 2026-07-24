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
import { SCORING_CALIBRATION_NOTE } from "../subjects/config.js";

// A genuine attempt at a 10/15/20-mark descriptive answer is always going
// to be several sentences -- an answer shorter than this was never going to
// score meaningfully, so grading it would just spend an AI call to confirm
// what's already obvious. Same "computational, not AI, where the AI adds no
// signal" principle as the empty-answer short-circuit below, just widened
// from exactly-zero to "clearly not a real attempt".
const MIN_ANSWER_WORDS = 20;

function wordCount(text) {
  return text && text.trim() ? text.trim().split(/\s+/).length : 0;
}

function buildSystem(subjectConfig) {
  const extraFieldsBlock = (subjectConfig.feedbackExtraFields || [])
    .map((f) => `  "${f}": [<0-4 short strings — specific items the answer should have engaged with but didn't; empty array if none>],`)
    .join("\n");

  return `You are grading a ${subjectConfig.examLabel} answer for practice purposes.
Be an exacting but fair examiner: ${subjectConfig.gradingRubricNotes}
${SCORING_CALIBRATION_NOTE}
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
  const words = wordCount(answerText);

  if (words < MIN_ANSWER_WORDS) {
    // Don't spend an API call grading an empty or clearly-too-short submission.
    return {
      score: 0,
      strengths: [],
      weaknesses: [words === 0 ? "No answer was submitted." : `Answer is too short (${words} words) to grade meaningfully — write at least ${MIN_ANSWER_WORDS} words.`],
      ...Object.fromEntries(extraFields.map((f) => [f, []])),
      verdict: words === 0 ? "Empty submission." : "Too short to grade.",
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
