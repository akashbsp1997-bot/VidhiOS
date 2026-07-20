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
// Text/JSON model: openrouter/free -- OpenRouter's own "Free Models Router"
// (https://openrouter.ai/docs/guides/routing/routers/free-router), not a
// single model. Switched here after TWO specific pinned free models failed
// in a row in production: openai/gpt-oss-20b:free hung until Vercel's own
// timeout, then google/gemma-4-31b-it:free came back 429 "rate-limited
// upstream" from its backing provider (Google AI Studio) and STAYED
// rate-limited across postToOpenRouter's retries (same model, same
// congested upstream every attempt). openrouter/free re-selects a model
// from the current pool of available :free models on every request, so
// each retry in postToOpenRouter below can land on a genuinely different
// underlying model/provider instead of hammering the one that's stuck --
// pairs directly with that retry logic. Response's `model` field reports
// which one actually answered, if that's ever needed for debugging.
// Real tradeoff, not free of one: since a different model can answer any
// given call, structured-JSON adherence will vary request-to-request more
// than with one pinned model -- accepted here because outright unavailability
// (what pinning one model just produced twice) is worse than that variance,
// and parseJSONLoosely()/the per-field normalization in lib/ingest/structure.js
// already defend against malformed output regardless of which model sent it.
// If this also proves unreliable, reconsider pinning a specific model again
// -- check https://openrouter.ai/api/v1/models for current $0-priced
// entries rather than assuming any one is stable long-term.
const MODEL = "openrouter/free";
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

// Live failure (2026-07-20): google/gemma-4-31b-it:free returned "429...
// temporarily rate-limited upstream... Please retry shortly" -- a
// transient, provider-side capacity issue on OpenRouter's free tier, not a
// bug and not something a longer timeout or a different model permanently
// fixes (any free model can get momentarily saturated). Retrying a couple
// of times with a short pause, exactly as OpenRouter's own error message
// suggests, resolves this in the common case without needing a human to
// notice and manually retry. Bounded to 2 retries / short delays so total
// worst-case time stays well under any caller's maxDuration even with the
// 45s per-attempt timeout above.
const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POSTs to an OpenRouter endpoint, retrying on 429 (rate limited) with a
 * short delay, and converting a timeout/network failure/non-2xx response
 * into a descriptive AIRequestError. Returns the successful Response on a
 * non-429 res.ok -- callers still parse the body themselves, since the
 * chat-completions and images endpoints have different response shapes.
 */
async function postToOpenRouter(url, apiKey, body) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RATE_LIMIT_RETRY_DELAY_MS);

    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new AIRequestError(
          `OpenRouter request timed out after ${AI_TIMEOUT_MS / 1000}s -- the free-tier model may be overloaded or rate-limited right now. Try again in a moment, or check https://openrouter.ai/activity for account/model status.`
        );
      }
      throw new AIRequestError(`Network error calling OpenRouter: ${err.message}`);
    }

    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) continue;

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new AIRequestError(`OpenRouter returned ${res.status}: ${bodyText.slice(0, 500)}`);
    }

    return res;
  }
}

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


  const res = await postToOpenRouter(API_URL, apiKey, {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

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

  const res = await postToOpenRouter(IMAGE_API_URL, apiKey, {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    output_format: "png",
  });

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
