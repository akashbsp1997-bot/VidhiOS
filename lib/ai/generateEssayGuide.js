// lib/ai/generateEssayGuide.js
//
// Lazily generates PLANNING guidance for one essay topic -- an approach
// note, the key dimensions/angles worth covering, and a sample outline --
// never a ready-made essay to copy. This is the "master content" a student
// plans their own essay from (see essay_guides in db/schema.js), generated
// once on first view and reused for every student after, same pattern as
// lib/ai/generateLesson.js's Teach content.

import { callClaudeForJSON } from "./client.js";
import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

function buildSystem() {
  return `You are a UPSC Civil Services Essay paper mentor. For the given essay topic, provide structured PLANNING guidance to help a student build their OWN essay -- angles to consider and a structural sketch, not finished prose to copy.
${ANTI_HALLUCINATION_NOTE} Only include a quote or specific reference if you are confident it is accurate -- an empty quotesAndReferences array is fine.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "approachNotes": "<150-250 words: how to interpret this topic and a sensible overall approach for a 1000-1200 word UPSC essay>",
  "keyDimensions": [
    { "dimension": "<e.g. Social, Economic, Political, Ethical, Environmental, Global, Historical, Philosophical>", "points": "<2-3 sentences on what to cover under this angle>" }
  ],
  "quotesAndReferences": ["<a relevant quote, thinker, or example worth citing -- only if genuinely confident, otherwise omit>"],
  "sampleOutline": {
    "intro": "<1-2 sentence suggestion for how to open>",
    "body": ["<body section 1 focus>", "<body section 2 focus>", "<body section 3 focus>"],
    "conclusion": "<1-2 sentence suggestion for how to close, forward-looking not just a summary>"
  }
}
Provide 3-5 keyDimensions.`;
}

function buildUserPrompt({ topicText, category }) {
  return `Essay topic: "${topicText}"
Theme: ${category}

Generate the planning guide now. Return only the JSON object.`;
}

export async function generateEssayGuide({ topicText, category }) {
  const result = await callClaudeForJSON({
    system: buildSystem(),
    user: buildUserPrompt({ topicText, category }),
    maxTokens: 2000,
  });
  return normalizeResult(result);
}

export function normalizeResult(raw) {
  const approachNotes = typeof raw?.approachNotes === "string" ? raw.approachNotes.trim().slice(0, 2000) : "";
  if (!approachNotes) throw new Error("Model did not return usable approachNotes");

  const keyDimensions = Array.isArray(raw?.keyDimensions)
    ? raw.keyDimensions
        .filter((d) => d && typeof d.dimension === "string" && typeof d.points === "string")
        .slice(0, 8)
        .map((d) => ({ dimension: d.dimension.slice(0, 60), points: d.points.slice(0, 400) }))
    : [];

  const quotesAndReferences = Array.isArray(raw?.quotesAndReferences)
    ? raw.quotesAndReferences.filter((q) => typeof q === "string" && q.trim()).slice(0, 6).map((q) => q.trim().slice(0, 300))
    : [];

  const rawOutline = raw?.sampleOutline || {};
  const sampleOutline = {
    intro: typeof rawOutline.intro === "string" ? rawOutline.intro.slice(0, 300) : "",
    body: Array.isArray(rawOutline.body) ? rawOutline.body.filter((b) => typeof b === "string").slice(0, 6).map((b) => b.slice(0, 200)) : [],
    conclusion: typeof rawOutline.conclusion === "string" ? rawOutline.conclusion.slice(0, 300) : "",
  };

  return { approachNotes, keyDimensions, quotesAndReferences, sampleOutline };
}
