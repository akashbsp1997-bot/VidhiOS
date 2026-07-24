// app/api/items/route.js
//
// GET -> this user's inventory: usable items (unlock_pass/lockdown_grace,
// unused) and badges (cosmetic_badge, always all of them -- see
// lib/gamification/items.js's listBadges for why cosmetic items never get
// "used up").
// POST { itemId, action: 'use_unlock_pass', subtopicId } -> redeems an
//      unlock_pass on one specific subtopic (early access).
// POST { itemId, action: 'use_lockdown_grace' } -> redeems a lockdown_grace
//      token, lifting an active lockdown for a window.
import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { listUsableItems, listBadges, useUnlockPass, useLockdownGrace } from "../../../lib/gamification/items.js";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const [usableItems, badges] = await Promise.all([listUsableItems(userId), listBadges(userId)]);
    return NextResponse.json({ usableItems, badges });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { itemId, action, subtopicId } = await request.json();
    if (!itemId || !action) return NextResponse.json({ error: "itemId and action are required" }, { status: 400 });

    if (action === "use_unlock_pass") {
      if (!subtopicId) return NextResponse.json({ error: "subtopicId is required for use_unlock_pass" }, { status: 400 });
      const result = await useUnlockPass(userId, Number(itemId), subtopicId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "use_lockdown_grace") {
      const result = await useLockdownGrace(userId, Number(itemId));
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
