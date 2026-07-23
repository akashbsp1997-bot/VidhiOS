// lib/ai/gradeEssay.js
//
// Grades one full essay submission holistically -- deliberately different
// criteria from lib/ai/grade.js's descriptive-answer grading, which rewards
// precise provisions/citations for a short factual answer. A real UPSC
// essay is judged on content depth, multi-dimensionality (does it explore
// social/economic/political/ethical/environmental/global angles as
// relevant, not just one narrow reading?), structure, balance, and
// language -- not citation accuracy.

import { callClaudeForJSON } from "./client.js";

function buildSystem() {
  return `You are grading a UPSC Civil Services Mains ESSAY paper submission for practice purposes -- a full essay (typically 1000-1200 words) on an abstract or thematic topic, not a short factual answer.
Be an exacting but fair examiner. Evaluate: how well the essay engages with and develops the given topic; multi-dimensionality (does it explore multiple relevant angles -- social, economic, political, ethical, environmental, global, historical -- rather than one narrow reading?); structure and flow (a real introduction, a coherent body, a forward-looking conclusion, not just a summary); balance (does it engage with counterpoints rather than argue one-sidedly?); and quality of language and use of examples/illustrations.
You are a practice aid, not the actual UPSC examiner -- do not claim more certainty than you have.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "score": <integer 0-100>,
  "strengths": [<1-4 short strings>],
  "weaknesses": [<1-4 short strings>],
  "missingDimensions": [<0-4 short strings -- angles/perspectives the essay should have engaged with but didn't; empty array if none>],
  "verdict": "<one or two sentence summary in plain language>"
}`;
}

function buildUserPrompt({ topicText, essayText }) {
  return `Essay topic: "${topicText}"

Candidate's essay:
"""
${essayText}
"""

Grade this essay now. Return only the JSON object.`;
}

export async function gradeEssay({ topicText, essayText }) {
  if (!essayText || !essayText.trim()) {
    return { score: 0, strengths: [], weaknesses: ["No essay was submitted."], missingDimensions: [], verdict: "Empty submission." };
  }

  const result = await callClaudeForJSON({
    system: buildSystem(),
    user: buildUserPrompt({ topicText, essayText }),
    maxTokens: 2000,
  });
  return normalizeResult(result);
}

export function normalizeResult(raw) {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw?.score) || 0)));
  const asStringArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : []);
  return {
    score,
    strengths: asStringArray(raw?.strengths),
    weaknesses: asStringArray(raw?.weaknesses),
    missingDimensions: asStringArray(raw?.missingDimensions),
    verdict: typeof raw?.verdict === "string" ? raw.verdict.slice(0, 500) : "",
  };
}
