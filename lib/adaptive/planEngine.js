// lib/adaptive/planEngine.js
//
// Piece B of the "1-year strategy" request: a day-wise tracker of topics to
// complete, tests to attempt, and revision to do. Pure, DB-free -- same
// discipline as lib/adaptive/unlocks.js/subjectUnlocks.js, independently
// testable with plain `node`. lib/adaptive/planState.js wraps this with the
// actual DB reads (subtopics, mastery, subject unlock timestamps).
//
// Explicitly COMPUTED, not AI-generated, per the user's own choice when this
// was scoped: a deterministic schedule built from data already tracked per
// subtopic (difficulty score, PYQ frequency, current mastery) plus each
// subject's real unlock timestamp (see lib/adaptive/subjectUnlocks.js) --
// nothing here calls the AI or invents content.
//
// Day numbers are 0-based, counting from the student's plan start date (the
// earliest subjectUnlocks.unlockedAt row -- see planStartDate in
// lib/adaptive/subjectUnlockState.js). "Day 0" is the day they onboarded.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function dayNumberForDate(planStartDate, date) {
  return Math.floor((date.getTime() - planStartDate.getTime()) / MS_PER_DAY);
}

export function dateForDayNumber(planStartDate, dayNumber) {
  return new Date(planStartDate.getTime() + dayNumber * MS_PER_DAY);
}

// A simple weekly rhythm: 5 days learning new topics, 1 day testing what was
// learned that week, 1 day revising the weakest topics learned so far. Not
// tied to real weekdays -- "day 5" of the cycle is a test day whether that
// calendar date is a Saturday or a Tuesday, since the plan's own day-0 is
// whenever the student onboarded, not a fixed calendar anchor.
export const WEEK_CYCLE = ["learn", "learn", "learn", "learn", "learn", "test", "revise"];

export function dayType(dayNumber) {
  return WEEK_CYCLE[((dayNumber % WEEK_CYCLE.length) + WEEK_CYCLE.length) % WEEK_CYCLE.length];
}

// How many new topics can be scheduled onto a single learn-day. With today's
// real content volume (~100 subtopics across GS2 + Law Optional) this never
// binds -- it exists so a much larger future syllabus still spreads across
// the year via learn-day capacity rather than only via calendar length.
export const MAX_TOPICS_PER_LEARN_DAY = 2;

// Basics-first within a subject, higher-yield (more PYQ appearances) breaking
// ties -- same ordering convention as lib/adaptive/unlocks.js's
// orderSubtopicsWithinPaper, extended with availableFromDay as the primary
// key so a subject that unlocks later (GS III at day ~90, GS IV at ~180)
// naturally schedules later without the caller needing to filter it out.
function byScheduleOrder(a, b) {
  return (
    a.availableFromDay - b.availableFromDay ||
    a.difficultyScore - b.difficultyScore ||
    b.pyqFrequency - a.pyqFrequency ||
    a.id.localeCompare(b.id)
  );
}

/**
 * subtopics: [{ id, difficultyScore, pyqFrequency, availableFromDay }]
 * (availableFromDay = the day number its subject was/will be unlocked).
 * Returns Map<subtopicId, dayNumber> -- the day each subtopic is first
 * scheduled to be learned. Monotonically non-decreasing day assignment,
 * respecting both each topic's own availableFromDay and the weekly
 * learn-day capacity.
 */
export function assignLearningDays(subtopics) {
  const queue = [...subtopics].sort(byScheduleOrder);
  const assignment = new Map();

  let day = 0;
  let used = 0;
  for (const s of queue) {
    let d = Math.max(day, s.availableFromDay);
    let u = d === day ? used : 0;
    while (dayType(d) !== "learn" || u >= MAX_TOPICS_PER_LEARN_DAY) {
      d += 1;
      u = 0;
    }
    assignment.set(s.id, d);
    day = d;
    used = u + 1;
  }
  return assignment;
}

export const REVISE_TOPICS_PER_DAY = 3;

/**
 * subtopics: [{ id, difficultyScore, pyqFrequency, availableFromDay,
 * masteryScore }]. Returns one entry per day in [fromDay, toDay]:
 * { day, type, subtopicIds }. "learn" days list topics newly scheduled that
 * day; "test" days list topics learned in the preceding 7 days (adaptive
 * practice already exists to serve the actual questions -- this just names
 * what to focus a practice session on); "revise" days list the
 * lowest-mastery topics learned so far, capped at REVISE_TOPICS_PER_DAY.
 */
export function buildDayPlan(subtopics, { fromDay, toDay }) {
  const learnDayBySubtopic = assignLearningDays(subtopics);

  const days = [];
  for (let day = fromDay; day <= toDay; day++) {
    const type = dayType(day);
    if (type === "learn") {
      const subtopicIds = subtopics.filter((s) => learnDayBySubtopic.get(s.id) === day).map((s) => s.id);
      days.push({ day, type, subtopicIds });
    } else if (type === "test") {
      const weekStart = day - 6;
      const subtopicIds = subtopics
        .filter((s) => {
          const ld = learnDayBySubtopic.get(s.id);
          return ld != null && ld >= weekStart && ld <= day;
        })
        .map((s) => s.id);
      days.push({ day, type, subtopicIds });
    } else {
      const learnedSoFar = subtopics.filter((s) => (learnDayBySubtopic.get(s.id) ?? Infinity) <= day);
      const subtopicIds = [...learnedSoFar]
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, REVISE_TOPICS_PER_DAY)
        .map((s) => s.id);
      days.push({ day, type, subtopicIds });
    }
  }
  return { days, learnDayBySubtopic };
}
