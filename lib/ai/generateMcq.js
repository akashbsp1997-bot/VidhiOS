// lib/ai/generateMcq.js
//
// Generates ONE fresh Prelims-style MCQ for a subtopic -- 4 options, one
// correct, a short explanation. Deliberately separate from
// lib/ai/generateQuestion.js's descriptive-question generator: different
// output shape (options/correctIndex, no marks tiering) and a different
// grading path -- deterministic option-match, no AI grading call needed
// (see app/api/mcq/route.js), unlike a descriptive answer which always
// needs lib/ai/grade.js.

import { callClaudeForJSON } from "./client.js";
import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

function buildSystem(subjectConfig) {
  return `You write UPSC Civil Services Prelims-style multiple-choice questions on ${subjectConfig.examLabel} topics, in the exact register of real UPSC Prelims questions (single correct answer, plausible distractors, no "all of the above"/"none of the above" unless genuinely warranted).
Ground every claim ONLY in material you are highly confident is accurate, or in the source excerpts provided to you. ${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "questionText": "<the question, in UPSC Prelims phrasing>",
  "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
  "correctIndex": <0-3, the index of the correct option>,
  "explanation": "<1-3 sentences explaining why the correct option is right>"
}`;
}

function buildUserPrompt({ subtopicText, sourceExcerpts }) {
  const grounding = sourceExcerpts && sourceExcerpts.length
    ? `\n\nGround your question in this real source material where relevant:\n"""\n${sourceExcerpts.join("\n---\n").slice(0, 6000)}\n"""`
    : "";
  return `Subtopic: ${subtopicText}${grounding}

Write ONE new MCQ now (not a real past paper question, an original one at typical UPSC Prelims difficulty). Return only the JSON object.`;
}

export async function generateMcq({ subtopicText, sourceExcerpts, subjectConfig }) {
  const result = await callClaudeForJSON({
    system: buildSystem(subjectConfig),
    user: buildUserPrompt({ subtopicText, sourceExcerpts }),
    maxTokens: 1500,
  });
  return normalizeMcqResult(result);
}

export function normalizeMcqResult(raw) {
  const questionText = typeof raw?.questionText === "string" ? raw.questionText.trim() : "";
  const options = Array.isArray(raw?.options)
    ? raw.options.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim())
    : [];
  const correctIndex = Number(raw?.correctIndex);
  const explanation = typeof raw?.explanation === "string" ? raw.explanation.trim() : "";
  if (!questionText || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    throw new Error("Model did not return a usable MCQ shape");
  }
  return { questionText, options, correctIndex, explanation };
}
