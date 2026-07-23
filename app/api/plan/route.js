// app/api/plan/route.js
//
// GET ?fromDay=&toDay= -> the computed day-wise plan for that window (see
// lib/adaptive/planEngine.js/planState.js). Defaults to a 2-week window
// centered just behind today, since that's what the /plan page and the
// dashboard's "today" card actually need -- pass an explicit range (e.g.
// fromDay=0&toDay=364) for a full-year view.
import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../lib/supabase/server.js";
import { getPlanWindow } from "../../../lib/adaptive/planState.js";
import { planStartDate } from "../../../lib/adaptive/subjectUnlockState.js";
import { dayNumberForDate } from "../../../lib/adaptive/planEngine.js";

// A window wider than this is very unlikely to be a real UI request and
// would just mean scanning more of the subtopic pool per request for no
// reason -- generous enough to cover a full year in one call if a caller
// genuinely wants that.
const MAX_WINDOW_DAYS = 370;

export async function GET(request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const start = await planStartDate(userId);
    if (!start) {
      return NextResponse.json({ error: "onboarding_not_complete" }, { status: 409 });
    }
    const todayDayNumber = dayNumberForDate(start, new Date());

    const { searchParams } = new URL(request.url);
    const fromDayParam = searchParams.get("fromDay");
    const toDayParam = searchParams.get("toDay");
    let fromDay = fromDayParam != null ? Number(fromDayParam) : Math.max(0, todayDayNumber - 2);
    let toDay = toDayParam != null ? Number(toDayParam) : todayDayNumber + 13;
    if (!Number.isFinite(fromDay) || !Number.isFinite(toDay) || toDay < fromDay) {
      return NextResponse.json({ error: "Invalid fromDay/toDay" }, { status: 400 });
    }
    toDay = Math.min(toDay, fromDay + MAX_WINDOW_DAYS);

    const result = await getPlanWindow(userId, { fromDay, toDay });
    if (!result) return NextResponse.json({ error: "onboarding_not_complete" }, { status: 409 });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
