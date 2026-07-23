// lib/adaptive/srs.js
//
// Simplified SM-2 spaced repetition -- the same algorithm Anki's
// predecessor SuperMemo used, adapted to a 3-button UI (Again/Good/Easy)
// instead of raw 0-5 quality input. Pure, DB-free -- lib/adaptive/
// flashcards.js derives the cards, app/api/flashcards/route.js owns the
// actual flashcard_reviews reads/writes.

export const MIN_EASE_FACTOR = 1.3;
export const DEFAULT_EASE_FACTOR = 2.5;

// Maps a 3-button UI onto SM-2's 0-5 quality scale. "Again" (<3) always
// resets the card to relearn from scratch; "Good"/"Easy" both count as a
// successful recall, differing only in how much the ease factor grows.
export const QUALITY = { again: 2, good: 4, easy: 5 };

/**
 * @param {{easeFactor?: number, intervalDays?: number, repetitions?: number}} state
 * @param {number} quality -- 0-5, see QUALITY above.
 * @returns {{easeFactor: number, intervalDays: number, repetitions: number}}
 */
export function reviewCard({ easeFactor = DEFAULT_EASE_FACTOR, intervalDays = 0, repetitions = 0 }, quality) {
  if (quality < 3) {
    return { easeFactor, intervalDays: 1, repetitions: 0 };
  }
  const newEase = Math.max(MIN_EASE_FACTOR, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  let newInterval;
  if (repetitions === 0) newInterval = 1;
  else if (repetitions === 1) newInterval = 6;
  else newInterval = Math.round(intervalDays * newEase);
  return { easeFactor: newEase, intervalDays: newInterval, repetitions: repetitions + 1 };
}
