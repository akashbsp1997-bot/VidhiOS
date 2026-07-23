// lib/ai/currentAffairs.js
//
// Condenses real news articles into 1-2 sentence exam-relevant summaries
// and best-effort tags them against real syllabus subtopics -- one batched
// call for up to MAX_ARTICLES_PER_RUN articles (see
// app/api/cron/fetch-current-affairs) rather than one call per article, to
// keep this a single cheap AI call per day-run instead of 10-20.

import { callClaudeForJSON } from "./client.js";
import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

function buildSystem() {
  return `You summarize news articles for UPSC Civil Services exam current-affairs preparation. For each article, write a 1-2 sentence summary of what happened and why it matters for GS/current affairs, and identify which of the given syllabus subtopics (if any) it's relevant to.
${ANTI_HALLUCINATION_NOTE} Only use subtopicIds from the provided list -- never invent one, and return an empty relatedSubtopicIds array if nothing clearly relates.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "items": [
    { "title": "<article title, copied verbatim from the input>", "summary": "<1-2 sentence exam-relevant summary>", "relatedSubtopicIds": ["<subtopicId>", ...] }
  ]
}
Return exactly one entry per article given, in the same order.`;
}

function buildUserPrompt({ articles, subtopicOptions }) {
  const articleList = articles.map((a, i) => `${i + 1}. "${a.title}" -- ${a.description || "(no description)"}`).join("\n");
  const subtopicList = subtopicOptions.map((s) => `${s.id}: ${s.topicText}`).join("\n");
  return `Articles:\n${articleList}\n\nSyllabus subtopics you may tag (id: text):\n${subtopicList}\n\nReturn the JSON object now.`;
}

export async function summarizeCurrentAffairs({ articles, subtopicOptions }) {
  const result = await callClaudeForJSON({
    system: buildSystem(),
    user: buildUserPrompt({ articles, subtopicOptions }),
    maxTokens: 3000,
  });
  return normalizeResult(result, articles);
}

export function normalizeResult(raw, articles) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return articles.map((a, i) => {
    const match = items[i]?.title === a.title ? items[i] : items.find((it) => it?.title === a.title) || items[i] || {};
    const summary = typeof match?.summary === "string" && match.summary.trim() ? match.summary.trim().slice(0, 400) : (a.description || "").slice(0, 300);
    const relatedSubtopicIds = Array.isArray(match?.relatedSubtopicIds) ? match.relatedSubtopicIds.filter((id) => typeof id === "string") : [];
    return { title: a.title, summary, relatedSubtopicIds };
  });
}
