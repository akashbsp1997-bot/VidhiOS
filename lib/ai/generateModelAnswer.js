// lib/ai/generateModelAnswer.js
//
// Generates a strong model answer for one question -- for a student to
// compare their own answer against as a free, instant self-check, not a
// substitute for full AI grading of their actual answer. Generated ONCE
// per (questionSource, questionRefId) and cached (see
// question_model_answers in db/schema.js) -- the whole point of this
// feature is converting grading's per-student AI cost into a per-question
// one, so this must never be regenerated per request.

import { callClaudeForJSON } from "./client.js";
import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

function buildSystem(subjectConfig) {
  return `You write a strong MODEL ANSWER for a ${subjectConfig.examLabel} practice question -- the kind of answer that would score close to full marks, for a student to compare their own answer against after they've already attempted it themselves.
Ground every claim ONLY in material you are highly confident is accurate. ${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "modelAnswer": "<a well-structured answer at the question's marks level -- brief intro, organized body, conclusion, roughly 100-150 words per 10 marks>",
  "keyPoints": ["<3-6 short bullet strings -- the essential points any strong answer should include>"]
}`;
}

function buildUserPrompt({ questionText, marks, subtopicText }) {
  return `Subtopic: ${subtopicText}
Question (${marks} marks): ${questionText}

Write the model answer now. Return only the JSON object.`;
}

export async function generateModelAnswer({ questionText, marks, subtopicText, subjectConfig }) {
  const result = await callClaudeForJSON({
    system: buildSystem(subjectConfig),
    user: buildUserPrompt({ questionText, marks, subtopicText }),
    maxTokens: 2000,
  });
  return normalizeResult(result);
}

export function normalizeResult(raw) {
  const modelAnswer = typeof raw?.modelAnswer === "string" ? raw.modelAnswer.trim().slice(0, 3000) : "";
  if (!modelAnswer) throw new Error("Model did not return a usable modelAnswer");
  const keyPoints = Array.isArray(raw?.keyPoints)
    ? raw.keyPoints.filter((p) => typeof p === "string" && p.trim()).slice(0, 8).map((p) => p.trim().slice(0, 300))
    : [];
  return { modelAnswer, keyPoints };
}
