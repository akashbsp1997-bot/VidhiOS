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
// Text/JSON model: NVIDIA Nemotron 3 Nano (nvidia/nemotron-3-nano-30b-a3b:free,
// a 30B-parameter/3B-active MoE model -- NVIDIA's own hosted infrastructure,
// not Google AI Studio or OpenAI's serving stack). Third pick after two
// straight production failures on other backends: openai/gpt-oss-20b:free
// hung until Vercel's own timeout; then google/gemma-4-31b-it:free came
// back 429 "rate-limited upstream" and STAYED that way even under
// postToOpenRouter's retries; switching to openrouter/free's auto-router
// (which re-selects a model per request) didn't help either -- it kept
// landing back on the same congested gemma-4-31b-it, confirmed live by the
// error still naming that exact model three separate times. That result
// means the router's pool wasn't actually diversifying away from Google's
// capacity for us in practice, so pinning a model on genuinely different
// infrastructure is the more direct fix here, not another routing layer.
// If NVIDIA's backend also proves congested, the durable fix is what
// OpenRouter's own 429 message suggests: link a personal Google AI Studio
// (or other provider) API key at https://openrouter.ai/settings/integrations
// for dedicated quota instead of the shared public free pool -- re-check
// https://openrouter.ai/api/v1/models for current $0-priced entries before
// picking again rather than assuming any one is stable long-term.
const MODEL = "nvidia/nemotron-3-nano-30b-a3b:free";
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
