// lib/ai/client.js
//
// Minimal server-side wrapper around Google's Gemini API
// (generativelanguage.googleapis.com), called DIRECTLY -- not through
// OpenRouter. Switched off OpenRouter (2026-07-22) after a live failure
// exposed a structural problem, not a transient one: OpenRouter's BYOK still
// pre-authorizes every request against the OpenRouter account's own credit
// BALANCE (worst case = the model's list price x max_tokens), before ever
// routing to the linked Google key -- a $0/near-$0 OpenRouter balance blocks
// every call outright regardless of BYOK's first-1M-requests/month fee-free
// allowance, since there's nothing for the pre-flight check to authorize
// against ("This request requires more credits... requested up to 1200
// tokens, but can only afford 1089"). Calling Google directly with the same
// Google AI Studio key removes that middleman gate entirely -- quota/billing
// is then Google's own free tier (no card required up to its daily/per-minute
// limits), not an OpenRouter balance the BYOK story implied you wouldn't need
// to maintain.
//
// This runs in your own Next.js API route, authenticates with your own key
// from an environment variable, and is never exposed to the browser. Other
// modules (grade.js, generateQuestion.js, generateLesson.js,
// generateModules.js) call callClaudeForJSON/callImageGen -- they never talk
// to Google directly, keep that boundary. (Function names kept for
// historical continuity with this project's very first iteration; nothing
// here has called Claude for a while now.)

// gemini-3.5-flash / gemini-3.1-flash-image are Google's own GA model ids --
// same generation this app already used via OpenRouter's "google/"-prefixed
// aliases, just without that prefix (Google's direct API doesn't use it).
// Re-verify against https://ai.google.dev/gemini-api/docs/models before ever
// repinning these.
const MODEL = "gemini-3.5-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Fallback text provider (2026-07-22, per explicit request) -- if Gemini is
// genuinely unavailable (a real demand spike outlasting its own retry
// budget, or its free-tier daily quota exhausted), callClaudeForJSON tries
// Groq before giving up, since it's a fully separate account/quota/
// infrastructure from Google's. Opt-in: only attempted when GROQ_API_KEY is
// actually set, so a deployment that hasn't configured it behaves exactly
// as before (Gemini's own error surfaces directly). Image generation has no
// Groq equivalent (Groq doesn't serve an image model) -- callImageGen stays
// Gemini-only; its callers already treat a failure there as non-fatal.
//
// openai/gpt-oss-120b verified live (2026-07-22) against Groq's own
// deprecations doc (console.groq.com/docs/deprecations) as the current
// migration target for several other models Groq is retiring mid-2026 --
// not llama-3.3-70b-versatile, which that same page lists as deprecated
// (shutdown 08/16/26). Re-verify against that page before ever repinning.
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// Deliberately smaller than Gemini's retry budget -- this only runs AFTER
// Gemini has already exhausted its own ~29s of backoff, so it needs to stay
// cheap rather than add another comparable delay on top and risk the whole
// request blowing past the caller's maxDuration (60-90s across the routes
// that reach this file).
const GROQ_MAX_RETRIES = 1;
const GROQ_RETRY_DELAY_MS = 2000;

// Same rationale as this file's previous OpenRouter version: bound the
// request well under any caller's maxDuration so a hang becomes a clear,
// catchable error instead of a platform-level timeout kill outside JS.
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
// Distinct from a generic AIRequestError -- thrown specifically for Google's
// non-transient PER-DAY quota exhaustion (see isDailyQuotaError below), never
// for a short per-minute burst limit (that's retried instead, same as this
// file always retried a transient 429). Lets a caller tell "come back later,
// nothing's broken" apart from "something's actually wrong" if it ever wants
// to, without string-matching the message.
class AIQuotaExceededError extends AIRequestError {}

// Live failure (2026-07-22): grading a real answer hit "503... currently
// experiencing high demand" and still failed after 2 retries at a flat 3s
// gap (6s of total backoff) -- too short to ride out a genuine capacity
// spike on the free tier, which Google's own message calls "usually
// temporary" but doesn't bound to a few seconds. Raised to 4 retries (5
// attempts total) with exponential backoff instead of a flat delay, capped
// so the worst case still fits well inside every caller's maxDuration (grade/
// question/lesson routes: 60-90s; a 503 fails fast, it doesn't hang, so the
// backoff delays below -- 2+4+8+15 = 29s -- dominate the worst-case total,
// not AI_TIMEOUT_MS x attempts).
const MAX_RATE_LIMIT_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 2000;
const RETRY_MAX_DELAY_MS = 15000;

function retryDelayMs(attempt) {
  return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status >= 500 && status < 600;
}

// Google's 429 body is { error: { code, message, status: "RESOURCE_EXHAUSTED",
// details: [...] } }, and that SAME status/code covers two very different
// situations: a short per-minute burst limit (worth a brief retry, exactly
// like this file already did for OpenRouter's transient 429s) and a hard
// per-day quota that will not recover no matter how many times this retries.
// Google names the exceeded quota metric in the message/details -- e.g.
// "...PerDayPerProjectPerModel..." vs "...PerMinutePerProjectPerModel..." --
// so this distinguishes on that substring rather than guessing from the
// status code alone.
function isDailyQuotaError(bodyText) {
  return /PerDay/i.test(bodyText) && !/PerMinute/i.test(bodyText);
}

function extractGoogleError(bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // bodyText wasn't JSON -- fall through to the raw text
  }
  return bodyText.slice(0, 500);
}

/**
 * POSTs to a Gemini generateContent endpoint, retrying on a transient
 * per-minute 429 or 5xx with a short delay, and converting a timeout/network
 * failure/non-2xx response into a descriptive, typed error. Returns the
 * successful Response on a non-retryable res.ok -- callers parse the body
 * themselves since text and image responses have different shapes.
 */
async function postToGemini(model, apiKey, body) {
  const url = `${API_BASE}/${model}:generateContent`;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs(attempt));

    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new AIRequestError(
          `Gemini API request timed out after ${AI_TIMEOUT_MS / 1000}s -- Google's servers may be overloaded right now. Try again in a moment.`
        );
      }
      throw new AIRequestError(`Network error calling the Gemini API: ${err.message}`);
    }

    if (res.status === 429) {
      const bodyText = await res.text().catch(() => "");

      if (isDailyQuotaError(bodyText)) {
        throw new AIQuotaExceededError(
          "Today's free Gemini API quota is used up. This resets daily (Pacific midnight) -- try again later, or enable billing on this Google AI Studio project to raise the limit at https://aistudio.google.com."
        );
      }

      if (attempt < MAX_RATE_LIMIT_RETRIES) continue;
      throw new AIRequestError(`Gemini API returned 429 (rate limited) after ${MAX_RATE_LIMIT_RETRIES} retries: ${extractGoogleError(bodyText)}`);
    }

    if (isRetryableStatus(res.status)) {
      const bodyText = await res.text().catch(() => "");
      if (attempt < MAX_RATE_LIMIT_RETRIES) continue;
      throw new AIRequestError(`Gemini API returned ${res.status} after ${MAX_RATE_LIMIT_RETRIES} retries: ${extractGoogleError(bodyText)}`);
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      if (res.status === 400 || res.status === 403) {
        throw new AIConfigError(`Gemini API rejected the request (${res.status}) -- check GOOGLE_AI_API_KEY is a valid Google AI Studio key: ${extractGoogleError(bodyText)}`);
      }
      throw new AIRequestError(`Gemini API returned ${res.status}: ${extractGoogleError(bodyText)}`);
    }

    return res;
  }
}

async function callGemini({ system, user, maxTokens }) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "GOOGLE_AI_API_KEY is not set. Add it to your .env.local (dev) or your Vercel project's environment variables (prod) -- the same Google AI Studio key from https://aistudio.google.com/apikey. See README.md."
    );
  }

  const res = await postToGemini(MODEL, apiKey, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    // Live failure (2026-07-22): a 1200-token call hit finishReason:
    // "MAX_TOKENS" despite the actual JSON output needing nowhere near that
    // much -- Gemini 3.x's default "medium" thinking level burns internal
    // reasoning tokens out of the SAME maxOutputTokens budget as the visible
    // output (contrary to what the separate-budget framing in older Gemini
    // 2.5 docs implies), so a plain content-extraction/JSON-formatting task
    // like every call through this function was silently losing most of its
    // budget to reasoning it doesn't need before ever writing the answer.
    // "minimal" is the lowest level Gemini 3.x's flash tier exposes (full
    // thinking-off isn't supported on this model class) -- every caller here
    // is a bounded, mechanical extraction/formatting task per its own system
    // prompt, never open-ended reasoning, so there's nothing this trades away.
    generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingLevel: "minimal" } },
  });

  const data = await res.json();
  const candidate = data.candidates?.[0];

  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new AIRequestError(`Gemini API returned no candidates${blockReason ? ` (blocked: ${blockReason})` : ""}.`);
  }

  const text = (candidate.content?.parts || []).map((p) => p.text || "").join("");

  if (candidate.finishReason === "MAX_TOKENS") {
    throw new AIRequestError(
      `Model response was cut off at the ${maxTokens}-token limit before finishing (finishReason: "MAX_TOKENS"). Raise maxTokens for this call rather than treating this as a JSON formatting bug.`
    );
  }

  return text;
}

/**
 * POSTs to Groq's OpenAI-compatible chat-completions endpoint. Mirrors
 * postToGemini's shape (timeout, retry-on-429/5xx, typed errors) but with a
 * much smaller retry budget -- see GROQ_MAX_RETRIES's comment above for why.
 */
async function postToGroq(apiKey, body) {
  for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(GROQ_RETRY_DELAY_MS);

    let res;
    try {
      res = await fetchWithTimeout(GROQ_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new AIRequestError(`Groq API request timed out after ${AI_TIMEOUT_MS / 1000}s.`);
      }
      throw new AIRequestError(`Network error calling the Groq API: ${err.message}`);
    }

    if ((res.status === 429 || isRetryableStatus(res.status)) && attempt < GROQ_MAX_RETRIES) continue;

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AIConfigError(`Groq API rejected the request (${res.status}) -- check GROQ_API_KEY is valid: ${extractGoogleError(bodyText)}`);
      }
      throw new AIRequestError(`Groq API returned ${res.status}: ${extractGoogleError(bodyText)}`);
    }

    return res;
  }
}

async function callGroq({ system, user, maxTokens }) {
  const apiKey = process.env.GROQ_API_KEY;
  const res = await postToGroq(apiKey, {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
  });

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) {
    throw new AIRequestError("Groq API returned no choices.");
  }

  if (choice.finish_reason === "length") {
    throw new AIRequestError(
      `Model response was cut off at the ${maxTokens}-token limit before finishing (finish_reason: "length"). Raise maxTokens for this call rather than treating this as a JSON formatting bug.`
    );
  }

  return choice.message?.content || "";
}

/**
 * Calls the model with a system prompt + single user turn, expecting it
 * to return ONLY a JSON object (no native JSON mode on this API, so we
 * instruct for it in the prompt and parse defensively here). Tries Gemini
 * first; if that fails for ANY reason (config, quota, exhausted retries)
 * and GROQ_API_KEY is set, falls back to Groq once before giving up --
 * see the GROQ_MODEL comment above for why this exists and what it does and
 * doesn't cover.
 */
export async function callClaudeForJSON({ system, user, maxTokens = 1000 }) {
  let text;
  try {
    text = await callGemini({ system, user, maxTokens });
  } catch (primaryErr) {
    if (!process.env.GROQ_API_KEY) throw primaryErr;
    try {
      console.error("Gemini call failed, falling back to Groq:", primaryErr.message);
      text = await callGroq({ system, user, maxTokens });
    } catch (fallbackErr) {
      throw new AIRequestError(`Both AI providers failed. Gemini: ${primaryErr.message} | Groq (fallback): ${fallbackErr.message}`);
    }
  }

  return parseJSONLoosely(text);
}

/**
 * Generates one image from a text prompt via Gemini's native image output
 * (generateContent with responseModalities:["IMAGE"], not a separate images
 * endpoint) and returns it as a data: URI (what db/schema.js's
 * visualImageDataUri columns and the Remember stage expect) — never a bare
 * URL or raw base64 string.
 */
export async function callImageGen({ prompt }) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "GOOGLE_AI_API_KEY is not set. Add it to your .env.local (dev) or your Vercel project's environment variables (prod). See README.md."
    );
  }

  const res = await postToGemini(IMAGE_MODEL, apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) {
    throw new AIRequestError("Gemini API returned no image data");
  }

  return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
}

/**
 * Strips ```json fences (and any stray prose the model might add despite
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

export { AIConfigError, AIRequestError, AIQuotaExceededError, MODEL, IMAGE_MODEL, GROQ_MODEL };
