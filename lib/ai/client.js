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
// Text/JSON model: Gemini 3.5 Flash (google/gemini-3.5-flash). Switched off
// the free-pool model chain (openai/gpt-oss-20b:free hung; then
// google/gemma-4-31b-it:free and nvidia/nemotron-3-nano-30b-a3b:free both
// eventually hit OpenRouter's ACCOUNT-WIDE "free-models-per-day" cap -- 50
// requests/day shared across every :free model on the account, a hard
// daily quota no amount of model-swapping within the free pool can avoid;
// see postToOpenRouter's 429 handling below) after linking a personal
// Google AI Studio key via OpenRouter's BYOK
// (https://openrouter.ai/workspaces/default/byok, "Google AI Studio" entry
// -- not "Google Vertex", which wants a service-account JSON instead of a
// plain API key). BYOK auto-routes any google/* request through that
// linked key/quota instead of OpenRouter's shared pool, with no per-request
// routing parameter needed, so this is normally a plain model-id swap.
//
// google/gemini-2.5-flash was the first pick here and failed live (2026-07-21)
// with a confusing OpenRouter 402 ("requires more credits") -- the REAL
// cause was buried in the error's previous_errors: Google AI Studio itself
// returned 404, "model gemini-2.5-flash is no longer available", i.e. it's
// retired on Google's live backend even though OpenRouter's own model
// catalog (GET https://openrouter.ai/api/v1/models) still lists it. That
// 404 on the BYOK attempt made OpenRouter fall through to a different,
// non-BYOK serving path for the same model id, which then billed against
// the (empty) OpenRouter account balance instead of the linked Google key
// -- hence the credits error looking unrelated to BYOK at first glance.
// google/gemini-3.5-flash is confirmed present in the live catalog as of
// this fix. Re-verify against that endpoint before ever repinning this --
// catalog presence alone doesn't guarantee the provider still serves it;
// prefer a concrete "google/gemini-<N>-flash" id over the catalog's
// "~google/gemini-flash-latest" alias entries (leading "~" in the id
// itself), whose direct-request semantics aren't confirmed here.
const MODEL = "google/gemini-3.5-flash";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Image model: Gemini 3.1 Flash Image ("Nano Banana 2", successor to the
// 2.5 generation's "Nano Banana") via OpenRouter's dedicated Image API (a
// separate endpoint from chat completions — verified against
// https://openrouter.ai/docs/guides/overview/multimodal/image-generation,
// not the same request/response shape as callClaudeForJSON above). Moved
// off google/gemini-2.5-flash-image pre-emptively alongside the text model
// fix above, on the same generation, rather than waiting to hit the
// identical "retired on Google's backend" failure live a second time.
const IMAGE_MODEL = "google/gemini-3.1-flash-image";
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
// 45s per-attempt timeout above. Also covers 5xx now (see RETRYABLE_STATUSES
// below) -- a live 503 "Google AI Studio is experiencing high demand" is the
// same kind of transient thing, just a different status code.
const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

// Both live 402/429 failures on this route (2026-07-21, 2026-07-20) turned
// out to have their REAL cause one level down, in
// error.metadata.previous_errors -- OpenRouter's own top-level message
// ("requires more credits", a bare 429) was misleading both times because
// it described a fallback/rate-limit symptom, not what actually went wrong
// at the provider (Google AI Studio returning 404 "model retired", then
// separately 503 "high demand"). previous_errors[].raw is itself a
// JSON-encoded string in practice, not a JSON object, hence the nested
// parse attempt. Used by every error thrown below so a future occurrence
// of this shape shows the real cause immediately instead of requiring
// another round of manually unwrapping the raw response body by hand.
function extractUpstreamError(bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    const prevError = parsed?.error?.metadata?.previous_errors?.[0];
    if (prevError) {
      let detail = prevError.message || "";
      if (typeof prevError.raw === "string") {
        try {
          const rawParsed = JSON.parse(prevError.raw);
          if (rawParsed?.error?.message) detail = rawParsed.error.message;
        } catch {
          // raw wasn't JSON -- keep whatever `detail` already has
        }
      }
      return `${prevError.provider_name || "upstream provider"} returned ${prevError.code}: ${detail || "(no message)"}`;
    }
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // bodyText wasn't JSON -- fall through to the raw text
  }
  return bodyText.slice(0, 500);
}

/**
 * POSTs to an OpenRouter endpoint, retrying on 429/5xx (transient) with a
 * short delay, and converting a timeout/network failure/non-2xx response
 * into a descriptive AIRequestError. Returns the successful Response on a
 * non-retryable res.ok -- callers still parse the body themselves, since the
 * chat-completions and images endpoints have different response shapes.
 * `body` always gets `provider: { allow_fallbacks: false }` merged in (see
 * callers) -- without it, a failure on the BYOK Google key silently falls
 * through to a different, non-BYOK provider billed against the OpenRouter
 * account's own (empty) balance, which is what turned a transient Google
 * 503 into a confusing "requires more credits" 402 on 2026-07-21.
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

    if (res.status === 429) {
      const bodyText = await res.text().catch(() => "");

      // Live failure (2026-07-20): distinct from the per-model transient
      // congestion this file already retries on ("...rate-limited upstream
      // ... retry shortly") -- this is OpenRouter's hard ACCOUNT-WIDE daily
      // cap on free models (50 requests/day, shared across every :free
      // model, not per-model). Retrying does nothing: the quota doesn't
      // refill until the clock resets, so burning MAX_RATE_LIMIT_RETRIES
      // against it just wastes wall-clock time. Detected via the
      // "free-models-per-day" code OpenRouter's error body names, or a
      // depleted x-ratelimit-remaining header as a fallback. Fail fast with
      // the reset time and the one real fix (OpenRouter's own message:
      // add $10 credits, one-time, to unlock 1000 free requests/day --
      // the models themselves stay free) instead of a generic 429 message
      // that reads like a retry would help. Not relevant to the BYOK Gemini
      // model this project uses now (not a :free model), but left in place
      // in case a future call ever reverts to a free-pool model.
      if (bodyText.includes("free-models-per-day") || res.headers.get("x-ratelimit-remaining") === "0") {
        const resetHeader = res.headers.get("x-ratelimit-reset");
        const resetAt = resetHeader && !Number.isNaN(Number(resetHeader)) ? new Date(Number(resetHeader)).toISOString() : null;
        throw new AIRequestError(
          `OpenRouter's free-tier daily quota is exhausted (50 requests/day, shared across all free models on this account)${resetAt ? `. It resets at ${resetAt}` : ""}. This is a hard daily cap, not a transient error -- retrying or switching models won't help right now. Add $10 in credits at https://openrouter.ai/settings/credits to raise the limit to 1000 free requests/day (a one-time anti-abuse unlock -- the models stay free), or wait for the reset.`
        );
      }

      if (attempt < MAX_RATE_LIMIT_RETRIES) continue;
      throw new AIRequestError(`OpenRouter returned 429 (rate limited) after ${MAX_RATE_LIMIT_RETRIES} retries: ${extractUpstreamError(bodyText)}`);
    }

    if (isRetryableStatus(res.status)) {
      const bodyText = await res.text().catch(() => "");
      if (attempt < MAX_RATE_LIMIT_RETRIES) continue;
      throw new AIRequestError(`OpenRouter returned ${res.status} after ${MAX_RATE_LIMIT_RETRIES} retries: ${extractUpstreamError(bodyText)}`);
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new AIRequestError(`OpenRouter returned ${res.status}: ${extractUpstreamError(bodyText)}`);
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
    provider: { allow_fallbacks: false },
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
    provider: { allow_fallbacks: false },
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
