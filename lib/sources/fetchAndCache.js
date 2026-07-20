// lib/sources/fetchAndCache.js
//
// Fetches one registered source URL, extracts plain text (HTML or PDF), and
// returns a truncated extract for caching. This is deliberately a pull
// model, not an autonomous crawler: something (a manual "refresh" click, or
// the Vercel Cron job wired in app/api/cron/refresh-sources) has to name a
// specific URL from the `sources` table. VidhiOS-adaptive does not go
// discover new URLs on its own — see docs/ARCHITECTURE.md for why (mostly:
// reliability and staying unambiguously on the safe side of source ToS).
//
// Needs `pdf-parse` (see package.json) for the PDF branch. The network calls
// in here were NOT executable inside the sandbox this repo was built in (no
// outbound network there) — the pure text-processing helpers below were unit
// tested directly; the fetch path itself should be smoke-tested against a
// couple of real URLs after you deploy, before relying on it.

const USER_AGENT = "VidhiOS-Adaptive/1.0 (personal study tool; not a bulk crawler)";
export const MAX_CHARS = 10000;

/**
 * Strips tags/scripts/styles/entities from an HTML string down to plain text.
 * Deliberately simple (no DOM) so it has zero extra dependencies — good
 * enough for extracting readable text from government bare-act/notice pages,
 * not intended as a general-purpose HTML-to-text library.
 */
export function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "\u2019");
}

/**
 * Collapses whitespace and truncates to a context-friendly length so a
 * single cached source can't blow out later LLM prompt budgets.
 */
export function cleanAndTruncate(text, maxChars = MAX_CHARS) {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars) + "\u2026";
}

function looksLikePdf(url, contentType) {
  return (contentType || "").toLowerCase().includes("pdf") || url.toLowerCase().split("?")[0].endsWith(".pdf");
}

/**
 * Fetches `url`, extracts text (PDF or HTML), and returns a cache-ready
 * record. Throws on any failure — callers (the API route / cron job) are
 * expected to catch, and persist { status: "error", errorMsg } so the source
 * registry shows what needs attention instead of silently going stale.
 *
 * `maxChars` lets callers apply the sourceTier-specific cap from
 * lib/sources/tiers.js (e.g. a much shorter cap for 'newspaper' rows, to
 * avoid caching a full paywalled article) -- defaults to the original
 * generous cap for backward compatibility. Callers must check
 * isFetchableTier() themselves before calling this at all; it has no
 * knowledge of tiers, only of a length limit.
 */
export async function fetchAndExtractText(url, { maxChars = MAX_CHARS } = {}) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());

  let rawText;
  if (looksLikePdf(url, contentType)) {
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buf);
    rawText = parsed.text;
  } else {
    rawText = stripHtml(buf.toString("utf-8"));
  }

  const extractedText = cleanAndTruncate(rawText, maxChars);
  if (!extractedText) {
    throw new Error("Fetched successfully but no extractable text was found (page may be JS-rendered or image-only)");
  }
  return { extractedText, fetchedAt: new Date() };
}
