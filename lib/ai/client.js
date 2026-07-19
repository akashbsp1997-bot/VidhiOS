// lib/ai/client.js
//
// Minimal server-side wrapper around the real Anthropic Messages API
// (https://docs.claude.com/en/api/overview). This is NOT the claude.ai
// artifact sandbox pattern — this runs in your own Next.js API route, so it
// authenticates with your own API key from an environment variable and is
// never exposed to the browser.
//
// Model: Claude Haiku 4.5 (claude-haiku-4-5-20251001) — grading fires on
// every submitted answer and question-generation fires occasionally, so a
// fast/cheap model is the right default. Swap MODEL below if you'd rather
// spend more for stronger grading (e.g. "claude-sonnet-5").

const MODEL = "anthropic/claude-haiku-4.5";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";


class AIConfigError extends Error {}
class AIRequestError extends Error {}

/**
 * Calls Claude with a system prompt + single user turn, expecting the model
 * to return ONLY a JSON object (no native JSON mode on this API, so we
 * instruct for it in the prompt and parse defensively here).
 */
export async function callClaudeForJSON({ system, user, maxTokens = 1000 }) {
    const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "OPENROUTER_API_KEY is not set. Add it to your .env.local (dev) or your Vercel project's environment variables (prod). See README.md."
    );
  }


  let res;
  try {
        res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

  } catch (err) {
    throw new AIRequestError(`Network error calling Anthropic API: ${err.message}`);
  }

    if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new AIRequestError(`OpenRouter returned ${res.status}: ${bodyText.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";


  return parseJSONLoosely(text);
}

/**
 * Strips ```json fences (and any stray prose Claude might add despite
 * instructions) and parses. Throws a descriptive error rather than silently
 * returning null, since a silent null here means the adaptive engine would
 * be making decisions on missing data.
 */
export function parseJSONLoosely(text) {
  if (!text || typeof text !== "string") {
    throw new AIRequestError("Empty response from model");
  }
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  // If the model wrapped the JSON in prose despite instructions, grab the
  // outermost {...} block.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new AIRequestError(`Could not parse model output as JSON: ${err.message}. Raw: ${text.slice(0, 300)}`);
  }
}

export { AIConfigError, AIRequestError, MODEL };
