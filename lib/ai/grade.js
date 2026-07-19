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

const SYSTEM = `You are grading a UPSC Civil Services Mains Law Optional answer for practice purposes.
Be an exacting but fair examiner: reward correct legal reasoning, accurate provisions/case law, structure (issue-rule-application-conclusion), and analytical depth appropriate to the marks. Penalise factual/legal errors, missing the actual question asked, and thin or generic answers.
If the candidate cites a specific Article, Section, Act, or case name, judge it only if you are confident of its accuracy; if you are not confident, say so in "weaknesses" rather than asserting it is wrong.
You are a practice aid, not the actual UPSC examiner — do not claim more certainty than you have.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "score": <integer 0-100>,
  "strengths": [<1-4 short strings>],
  "weaknesses": [<1-4 short strings>],
  "missedProvisions": [<0-4 short strings — specific Articles/Sections/cases the answer should have engaged with but didn't; empty array if none>],
  "verdict": "<one or two sentence summary in plain language>"
}`;

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
 * @returns {Promise<{score:number, strengths:string[], weaknesses:string[], missedProvisions:string[], verdict:string}>}
 */
export async function gradeAnswer({ questionText, marks, subtopicText, answerText }) {
  if (!answerText || !answerText.trim()) {
    // Don't spend an API call grading an empty submission.
    return {
      score: 0,
      strengths: [],
      weaknesses: ["No answer was submitted."],
      missedProvisions: [],
      verdict: "Empty submission.",
    };
  }

  const result = await callClaudeForJSON({
    system: SYSTEM,
    user: buildUserPrompt({ questionText, marks, subtopicText, answerText }),
    maxTokens: 700,
  });

  return normalizeGradeResult(result);
}

/**
 * Clamps/coerces the model's output into a shape the DB/engine can trust,
 * rather than assuming the model followed the schema exactly.
 */
export function normalizeGradeResult(raw) {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw?.score) || 0)));
  const asStringArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : []);
  return {
    score,
    strengths: asStringArray(raw?.strengths),
    weaknesses: asStringArray(raw?.weaknesses),
    missedProvisions: asStringArray(raw?.missedProvisions),
    verdict: typeof raw?.verdict === "string" ? raw.verdict.slice(0, 500) : "",
  };
}
