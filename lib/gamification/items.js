// lib/gamification/items.js
//
// Special-access items: what a completed daily mission (see missions.js)
// actually grants, and what redeeming one does. Three types, per explicit
// request that a mission's reward is randomly one of all three -- weighted
// so the two functional types (which genuinely bypass a real gate) are
// rarer than the cosmetic one, same spirit as any loot table where the
// most powerful reward isn't the most common one.

import { eq, and, isNull, ne } from "drizzle-orm";
import { db } from "../db.js";
import { playerItems, playerState, mastery, subtopics } from "../../db/schema.js";

export const ITEM_TYPES = ["unlock_pass", "lockdown_grace", "cosmetic_badge"];

// Rarer functional rewards, more common cosmetic ones -- see file header.
const ITEM_WEIGHTS = { unlock_pass: 0.25, lockdown_grace: 0.15, cosmetic_badge: 0.6 };

const UNLOCK_PASS_WINDOW_MS = 48 * 60 * 60 * 1000; // "early access" -- see db/schema.js's mastery.unlockOverrideUntil
const LOCKDOWN_GRACE_WINDOW_MS = 72 * 60 * 60 * 1000;

const BADGE_NAMES = [
  "Early Bird", "Streak Keeper", "Night Owl Scholar", "Steady Hand", "Sharp Shooter",
  "Comeback Kid", "Consistency Medal", "Focus Badge", "Momentum Trophy", "Iron Will",
];

function pickWeighted(weights, rng = Math.random) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function labelFor(itemType) {
  if (itemType === "unlock_pass") return "48h Early Access Pass";
  if (itemType === "lockdown_grace") return "72h Lockdown Grace Token";
  const name = BADGE_NAMES[Math.floor(Math.random() * BADGE_NAMES.length)];
  return `Badge — ${name}`;
}

/**
 * Rolls and inserts one random item for a just-completed mission. Pure
 * randomness in, one DB write out -- kept here (not missions.js) so the
 * loot table itself stays in one place.
 */
export async function grantRandomItem(userId, missionKey, rng = Math.random) {
  const itemType = pickWeighted(ITEM_WEIGHTS, rng);
  const [item] = await db
    .insert(playerItems)
    .values({ userId, itemType, label: labelFor(itemType), earnedFromMissionKey: missionKey })
    .returning();
  return item;
}

/** Unused unlock_pass/lockdown_grace items -- the "actionable" inventory (cosmetic badges never appear here, see file header). */
export async function listUsableItems(userId) {
  return db
    .select()
    .from(playerItems)
    .where(and(eq(playerItems.userId, userId), isNull(playerItems.usedAt), ne(playerItems.itemType, "cosmetic_badge")));
}

/** Every cosmetic badge ever earned -- the trophy case, always fully visible, never "used up." */
export async function listBadges(userId) {
  return db
    .select()
    .from(playerItems)
    .where(and(eq(playerItems.userId, userId), eq(playerItems.itemType, "cosmetic_badge")));
}

async function claimItem(userId, itemId, expectedType) {
  const [item] = await db.select().from(playerItems).where(eq(playerItems.id, itemId));
  if (!item || item.userId !== userId) throw new Error("Item not found.");
  if (item.itemType !== expectedType) throw new Error(`This item isn't a ${expectedType}.`);
  if (item.usedAt) throw new Error("This item has already been used.");
  return item;
}

/**
 * Redeems an unlock_pass on one specific subtopic -- see
 * lib/adaptive/lockState.js's loadPaperLockMap for how unlockOverrideUntil
 * is actually honored. Upserts the mastery row if this user has never
 * touched this subtopic yet (the column lives there, not on a separate
 * table, so a row has to exist to hold it).
 */
export async function useUnlockPass(userId, itemId, subtopicId) {
  const item = await claimItem(userId, itemId, "unlock_pass");
  const [subtopic] = await db.select({ id: subtopics.id }).from(subtopics).where(eq(subtopics.id, subtopicId));
  if (!subtopic) throw new Error(`Unknown subtopic: ${subtopicId}`);

  const until = new Date(Date.now() + UNLOCK_PASS_WINDOW_MS);
  const existing = await db.select().from(mastery).where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
  if (existing[0]) {
    await db.update(mastery).set({ unlockOverrideUntil: until }).where(and(eq(mastery.userId, userId), eq(mastery.subtopicId, subtopicId)));
  } else {
    await db.insert(mastery).values({ userId, subtopicId, unlockOverrideUntil: until });
  }
  await db.update(playerItems).set({ usedAt: new Date() }).where(eq(playerItems.id, item.id));
  return { subtopicId, unlockOverrideUntil: until };
}

/** Redeems a lockdown_grace token -- see subjectUnlockState.js's checkLockdown. */
export async function useLockdownGrace(userId, itemId) {
  const item = await claimItem(userId, itemId, "lockdown_grace");
  const until = new Date(Date.now() + LOCKDOWN_GRACE_WINDOW_MS);
  await db
    .insert(playerState)
    .values({ userId, lockdownGraceUntil: until })
    .onConflictDoUpdate({ target: playerState.userId, set: { lockdownGraceUntil: until } });
  await db.update(playerItems).set({ usedAt: new Date() }).where(eq(playerItems.id, item.id));
  return { lockdownGraceUntil: until };
}
