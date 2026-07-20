// lib/ai/client.js
//
// Minimal server-side wrapper around OpenRouter's API (https://openrouter.ai/docs)
// — used instead of calling Anthropic directly because Anthropic's console
// requires prepaid billing and OpenRouter was preferred. This runs in your
// own Next.js API route, so it authenticates with your own API key from an
// environment variable and is never exposed to the browser. Other modules
// (grade.js, generateQuestion.js, generateLesson.js) call callClaudeForJSON/
// callImageGen — they never hit OpenRouter directly, keep that boundary.
//
// Text/JSON model: OpenAI gpt-oss-20b (openai/gpt-oss-20b:free) -- a free
// OpenRouter model with solid structured-JSON reliability. The previous pick
// here, deepseek/deepseek-chat-v3.1:free, was pulled from OpenRouter's free
// tier entirely (its API started 404ing with "This model is unavailable for
// free") -- confirmed directly against OpenRouter's live /api/v1/models
// catalog before choosing this replacement, not guessed. Free-tier models
// can be deprioritized/removed by OpenRouter at any time; if this one also
// stops working, re-check https://openrouter.ai/api/v1/models for current
// $0-priced entries (openrouter.ai/models?max_price=0 is the same list via
// the web UI) rather than assuming any specific slug is permanent.
const MODEL = "openai/gpt-oss-20b:free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Image model: Gemini 2.5 Flash Image ("Nano Banana") via OpenRouter's
// dedicated Image API (a separate endpoint from chat completions — verified
// against https://openrouter.ai/docs/guides/overview/multimodal/image-generation,
// not the same request/response shape as callClaudeForJSON above).
const IMAGE_MODEL = "google/gemini-2.5-flash-image";
const IMAGE_API_URL = "https://openrouter.ai/api/v1/images";

// Live failure (2026-07-20): the ingest-structuring route hit Vercel's
// FUNCTION_INVOCATION_TIMEOUT -- a platform-level kill that happens OUTSIDE
// JS, invisible to any try/catch here, because the fetch() below had no
// timeout of its own and OpenRouter's free-tier model just hung rather than
// erroring. Bounding the request ourselves, well under any caller's
// maxDuration, converts that into a normal, catchable AIRequestError with a
// clear message instead of a bare platform crash page the caller can't
// parse or react to.
const AI_TIMEOUT_MS = 45000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class AIConfigError extends Error {}
class AIRequestError extends Error {}

/**
 * Calls the model with a system prompt + single user turn, expecting it
 * to return ONLY a JSON object (no native JSON mode on this API, so we
 * instruct for it in the prompt and parse defensively here).
 */
export async function callClaudeForJSON({ system, user, maxTokens = 1000 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "OPENROUTER_API_KEY is not set. Add it to your .env.local (dev) or your Vercel project's environment variables (prod). Get a key at https://openrouter.ai/keys. See README.md."
    );
  }


  let res;
  try {
    res = await fetchWithTimeout(API_URL, {
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
    if (err.name === "AbortError") {
      throw new AIRequestError(
        `OpenRouter request timed out after ${AI_TIMEOUT_MS / 1000}s -- the free-tier model may be overloaded or rate-limited right now. Try again in a moment, or check https://openrouter.ai/activity for account/model status.`
      );
    }
    throw new AIRequestError(`Network error calling OpenRouter: ${err.message}`);
  }

    if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new AIRequestError(`OpenRouter returned ${res.status}: ${bodyText.slice(0, 500)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const text = choice?.message?.content || "";

  if (choice?.finish_reason === "length") {
    throw new AIRequestError(
      `Model response was cut off at the ${maxTokens}-token limit before finishing (finish_reason: "length"). Raise maxTokens for this call rather than treating this as a JSON formatting bug.`
    );
  }

  return parseJSONLoosely(text);
}

/**
 * Strips ```json fences (and any stray prose Claude might add despite
 * instructions) and parses. Throws a descriptive error rather than silently
 * returning null, since a silent null here means the adaptive engine would
 * be making decisions on missing data.
 */
/**
 * Generates one image from a text prompt via OpenRouter's dedicated Image
 * API and returns it as a data: URI (what db/schema.js's
 * lessons.visualImageDataUri column and the Remember stage expect) — never
 * a bare URL or raw base64 string.
 */
export async function callImageGen({ prompt }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "OPENROUTER_API_KEY is not set. Add it to your .env.local (dev) or your Vercel project's environment variables (prod). Get a key at https://openrouter.ai/keys. See README.md."
    );
  }

  let res;
  try {
    res = await fetchWithTimeout(IMAGE_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        n: 1,
        output_format: "png",
      }),
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new AIRequestError(`OpenRouter image request timed out after ${AI_TIMEOUT_MS / 1000}s.`);
    }
    throw new AIRequestError(`Network error calling OpenRouter image API: ${err.message}`);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new AIRequestError(`OpenRouter image API returned ${res.status}: ${bodyText.slice(0, 500)}`);
  }

  const data = await res.json();
  const image = data.data?.[0];
  if (!image?.b64_json) {
    throw new AIRequestError("OpenRouter image API returned no image data");
  }

  return `data:${image.media_type || "image/png"};base64,${image.b64_json}`;
}

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

export { AIConfigError, AIRequestError, MODEL, IMAGE_MODEL };
