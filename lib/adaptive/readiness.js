// lib/adaptive/readiness.js
//
// Pure streak-calculation logic for the readiness dashboard
// (app/api/readiness/route.js) -- same DB-free discipline as the rest of
// lib/adaptive/*. Deliberately does NOT compute a single blended "readiness
// score": mastery, MCQ accuracy, and mock-test performance are three
// genuinely different signals with no defensible weighting between them, so
// the dashboard shows them side by side instead of inventing one number
// that would imply false precision.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {string[]} dateStrings -- 'YYYY-MM-DD' dates with any activity
 *   (duplicates fine, order doesn't matter).
 * @param {string} todayStr -- 'YYYY-MM-DD', injected rather than computed
 *   internally so this stays pure/testable.
 * @returns {{current: number, best: number, lastActiveDate: string|null}}
 *   `current` is 0 if the most recent activity was more than a day ago (a
 *   lapsed streak, not an ongoing one) -- "today or yesterday" both count as
 *   ongoing so a streak isn't punished before the current day is even over.
 */
export function computeStreak(dateStrings, todayStr) {
  const dates = [...new Set(dateStrings)].sort();
  if (!dates.length) return { current: 0, best: 0, lastActiveDate: null };

  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const gapDays = Math.round((dayMs(dates[i]) - dayMs(dates[i - 1])) / MS_PER_DAY);
    run = gapDays === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const last = dates[dates.length - 1];
  const daysSinceLast = Math.round((dayMs(todayStr) - dayMs(last)) / MS_PER_DAY);

  let current = 0;
  if (daysSinceLast <= 1) {
    current = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      const gapDays = Math.round((dayMs(dates[i]) - dayMs(dates[i - 1])) / MS_PER_DAY);
      if (gapDays === 1) current += 1;
      else break;
    }
  }

  return { current, best, lastActiveDate: last };
}

function dayMs(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getTime();
}
