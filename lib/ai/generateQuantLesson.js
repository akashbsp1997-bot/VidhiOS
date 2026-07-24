// lib/ai/generateQuantLesson.js
//
// Generates a short "explanation + shortcuts" refresher for one CSAT quant
// subtopic, shown above each question in the Quant Puzzle Chain (see
// app/api/quant-lesson/route.js, components/QuantPuzzleChain.jsx) -- the
// "short lesson... proof of concepts and shortcuts first" piece of the
// 2026-07-24 content-first change, in the Puzzle Chain's own lightweight
// game style rather than the heavy Teach/Grasp/Remember/Test module system.
//
// Model-knowledge-grounded only, no sourceExcerpts param -- CSAT quant's
// `sources` rows carry real NCERT book/class metadata but no extracted
// chapter text (never fetched, a separate content-sourcing task, not in
// scope here), and it has zero real PYQs (pyqFrequency: 0 on every seeded
// subtopic) to reference either. Same honest degrade-to-model-knowledge this
// app already falls back to everywhere else when grounding is unavailable.

import { callClaudeForJSON } from "./client.js";
import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

function buildSystem(subjectConfig) {
  return `You write a short "quick refresher" for ONE narrow CSAT quantitative-aptitude subtopic (${subjectConfig.examLabel}), for a self-study aspirant about to practice questions on it. Cover the core concept and how to work it out, then separately give practical shortcuts/tricks for solving it fast under exam time pressure.
${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "explanation": "<120-220 words as a BULLETED list, not connected prose -- one clear, self-contained point per line, each line starting with '- ', separated by \\n (a single newline, not \\n\\n). Cover what the concept/formula is, a brief proof-of-concept or worked mini-example showing WHY it works, and the standard method to solve it.>",
  "shortcuts": [ "<a short, practical shortcut/trick for solving this fast -- e.g. a mental-math trick, a pattern to spot, an elimination technique. HARD CAP: 25 words.>" ]
}
Provide 3-5 shortcuts. Every field has a hard word/count cap stated above -- stop well before it, do not pad to fill it.`;
}

function buildUserPrompt({ subtopicText }) {
  return `Subtopic: ${subtopicText}

Write this subtopic's quick refresher now. Return only the JSON object.`;
}

export async function generateQuantLesson({ subtopicText, subjectConfig }) {
  const raw = await callClaudeForJSON({
    system: buildSystem(subjectConfig),
    user: buildUserPrompt({ subtopicText }),
    maxTokens: 1200,
  });
  return normalizeQuantLessonResult(raw);
}

export function normalizeQuantLessonResult(raw) {
  const explanation = typeof raw?.explanation === "string" ? raw.explanation.trim() : "";
  if (!explanation) {
    throw new Error("Model did not return a usable explanation");
  }
  const shortcuts = Array.isArray(raw?.shortcuts)
    ? raw.shortcuts.filter((s) => typeof s === "string" && s.trim()).slice(0, 5).map((s) => s.trim().slice(0, 200))
    : [];
  return { explanation: explanation.slice(0, 2500), shortcuts };
}
