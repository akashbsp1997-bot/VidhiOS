// app/api/cron/send-reminders/route.js
//
// Wired to Vercel Cron via vercel.json (daily). Emails every onboarded user
// their day-wise plan entry for today (see lib/adaptive/planState.js) --
// entirely opt-in: no-ops with a clear message if RESEND_API_KEY isn't set,
// same convention as lib/ai/client.js's Groq fallback. Sends at a single
// fixed UTC hour -- this app doesn't track per-user timezone, so "morning"
// is necessarily approximate; a real per-timezone send time would need a
// timezone field added to onboarding first, out of scope for this pass.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../lib/db.js";
import { subjectUnlocks } from "../../../../db/schema.js";
import { sendEmail } from "../../../../lib/notifications/resend.js";
import { getPlanWindow } from "../../../../lib/adaptive/planState.js";
import { dayNumberForDate } from "../../../../lib/adaptive/planEngine.js";
import { planStartDate } from "../../../../lib/adaptive/subjectUnlockState.js";

const DAY_TYPE_LABEL = { learn: "Learn", test: "Test", revise: "Revise" };

function buildReminderHtml(today) {
  const label = DAY_TYPE_LABEL[today.type] ?? today.type;
  const items = today.topics.map((t) => `<li>${t.topicText} <span style="color:#888">(${t.subjectDisplayName})</span></li>`).join("");
  const body = today.type === "test" ? "<p>Attempt adaptive practice covering what you learned this week.</p>" : `<ul>${items}</ul>`;
  return `<h2>Today's plan: ${label}</h2>${body}<p><a href="https://vidhi-os-chi.vercel.app/plan">Open your full plan &rarr;</a></p>`;
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ status: "skipped", message: "RESEND_API_KEY not set -- reminder emails are opt-in." });
  }

  const rows = await db.select({ userId: subjectUnlocks.userId }).from(subjectUnlocks);
  const userIds = [...new Set(rows.map((r) => r.userId))];

  const results = [];
  for (const userId of userIds) {
    try {
      const start = await planStartDate(userId);
      if (!start) {
        results.push({ userId, status: "no-plan" });
        continue;
      }
      const todayDayNumber = dayNumberForDate(start, new Date());
      const window = await getPlanWindow(userId, { fromDay: todayDayNumber, toDay: todayDayNumber });
      const today = window?.days?.[0];
      if (!today || today.topics.length === 0) {
        results.push({ userId, status: "nothing-scheduled" });
        continue;
      }

      const emailRows = await db.execute(sql`select email from auth.users where id = ${userId}`);
      const email = emailRows[0]?.email;
      if (!email) {
        results.push({ userId, status: "no-email" });
        continue;
      }

      await sendEmail({ to: email, subject: `Today's plan: ${DAY_TYPE_LABEL[today.type] ?? today.type}`, html: buildReminderHtml(today) });
      results.push({ userId, status: "sent" });
    } catch (err) {
      results.push({ userId, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ checked: userIds.length, results });
}
