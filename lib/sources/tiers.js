// lib/sources/tiers.js
//
// Fetch/caching and AI-grounding-priority policy for the sources.sourceTier
// hierarchy (see db/schema.js's comment on that column): NCERT/official govt
// content can be fetched and cached in full; newspapers are capped to a
// short excerpt rather than a full paywalled article; private vendor links
// (Vision IAS, Rau's, Drishti, StudyIQ, PhysicsWallah, ...) are never
// fetched at all -- title/url only. That last one is a deliberate,
// non-negotiable policy, not a placeholder: these companies sell this exact
// content and most prohibit scraping in their ToS, and at this app's
// intended scale, caching and serving their notes back out to many users
// would be redistributing paid content, not personal study notes.

import { MAX_CHARS } from "./fetchAndCache.js";

export const TIER_PRIORITY = ["ncert", "official", "newspaper", "private_vendor"];

const TIER_MAX_CHARS = {
  ncert: MAX_CHARS,
  official: MAX_CHARS,
  newspaper: 2000,
};

export function isFetchableTier(sourceTier) {
  return sourceTier !== "private_vendor";
}

export function maxCharsForTier(sourceTier) {
  // Rows added before sourceTier existed (still nullable -- see PR1) get the
  // full-length default rather than the short excerpt cap.
  return TIER_MAX_CHARS[sourceTier] ?? MAX_CHARS;
}

/**
 * Sorts source rows so higher-trust tiers win when a caller only takes the
 * first N rows for AI grounding (see app/api/lesson/route.js,
 * app/api/attempt/route.js). Untiered rows (added before this column
 * existed) sort just after 'newspaper' and before 'private_vendor', on the
 * assumption pre-existing rows are official-equivalent content, not
 * unvetted.
 */
export function sortByTierPriority(rows) {
  const rank = (tier) => {
    if (!tier) return TIER_PRIORITY.indexOf("newspaper") + 0.5;
    const idx = TIER_PRIORITY.indexOf(tier);
    return idx === -1 ? TIER_PRIORITY.length : idx;
  };
  return [...rows].sort((a, b) => rank(a.sourceTier) - rank(b.sourceTier));
}
