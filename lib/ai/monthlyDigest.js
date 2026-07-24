// lib/ai/monthlyDigest.js
//
// Synthesizes ONE month's worth of already-stored daily current-affairs
// items (current_affairs_items -- each already an AI-condensed 1-2 sentence
// summary of a real public news article, never the article's own text) into
// a theme-grouped monthly overview. Deliberately built from this app's own
// already-legitimate data, not sourced from any external "monthly current
// affairs" compilation -- those are coaching-company-authored products,
// same copyright issue as any other coaching content (see lib/sources/
// tiers.js). Generated once per month, cached forever, same pattern as
// essay guides/model answers -- one AI call serves every student who views
// that month, not one per student per view.

import { callClaudeForJSON } from "./client.js";
import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

function buildSystem() {
  return `You write a monthly current-affairs overview for UPSC Civil Services exam preparation, from a list of daily news summaries already condensed for this exact purpose (not raw articles). Group them into 4-8 syllabus-relevant themes (e.g. "Economy & Governance", "International Relations", "Environment & Science", "Polity & Judiciary") and pick the items that most matter for exam prep within each.
${ANTI_HALLUCINATION_NOTE} Base every point ONLY on the summaries given to you -- do not add outside facts or events not present in the input.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "overview": "<2-3 sentence overview of the month's most exam-relevant throughlines>",
  "themes": [
    { "theme": "<short theme label, max 6 words>", "points": ["<1 sentence, a specific development from the given summaries>"] }
  ]
}
Provide 4-8 themes, each with 2-5 points. Every point must trace back to something actually in the given daily summaries.`;
}

function buildUserPrompt({ month, items }) {
  const list = items.map((it, i) => `${i + 1}. [${it.publishedDate}] ${it.title} -- ${it.summary}`).join("\n");
  return `Month: ${month}\n\nDaily current-affairs summaries from this month:\n${list}\n\nWrite the monthly overview now. Return only the JSON object.`;
}

export async function generateMonthlyDigest({ month, items }) {
  const result = await callClaudeForJSON({
    system: buildSystem(),
    user: buildUserPrompt({ month, items }),
    maxTokens: 4000,
  });
  return normalizeMonthlyDigestResult(result);
}

export function normalizeMonthlyDigestResult(raw) {
  const overview = typeof raw?.overview === "string" ? raw.overview.trim().slice(0, 600) : "";
  const themes = Array.isArray(raw?.themes)
    ? raw.themes
        .filter((t) => t && typeof t.theme === "string" && Array.isArray(t.points))
        .slice(0, 10)
        .map((t) => ({
          theme: t.theme.slice(0, 80),
          points: t.points.filter((p) => typeof p === "string").slice(0, 8).map((p) => p.slice(0, 300)),
        }))
    : [];
  if (!overview) throw new Error("Model did not return a usable monthly digest overview");
  return { overview, themes };
}
