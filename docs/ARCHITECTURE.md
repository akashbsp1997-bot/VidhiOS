# Architecture & design decisions

This doc exists so future-you (or future-me, in a follow-up chat) doesn't have to
reverse-engineer *why* something works the way it does.

## Stack, and why

- **Next.js (App Router)** — one deployable that covers frontend, API routes,
  and scheduled jobs (Vercel Cron), matching your existing Vercel-first
  workflow without needing a second service for the backend.
- **Supabase Postgres + Drizzle ORM** — same ORM you've already used
  (PostGrid/PFMP), Postgres gives you real arrays/jsonb for topics and
  feedback, and Supabase's free tier + table-editor GUI means you can
  eyeball/edit data without writing SQL if you don't want to.
- **Plain JS, not TypeScript** — the one deliberate stack deviation from your
  other projects. This repo was built in a sandbox with no npm registry
  access, so nothing here could be `tsc`-checked; JS avoids a whole class of
  type errors I couldn't verify. If you'd rather have TypeScript, it's a
  mechanical migration (add `tsconfig.json`, rename files, annotate).

## The adaptive engine (`lib/adaptive/engine.js`)

Deliberately not a black box — every rule is a short, named, unit-tested
function:

- **Mastery** (0-1 per subtopic) moves toward whatever score you just earned,
  with a learning rate that's high on your first few attempts at a subtopic
  and settles to a 0.15 floor — it never goes fully rigid, because the input
  signal (an AI-graded essay score) is approximate, not a clean psychometric
  response.
- **Difficulty tier** (1-3) only moves on two consecutive strong (\u226575) or
  weak (<45) scores, so one lucky or unlucky answer can't swing it.
- **Which subtopic comes next** is a weighted lottery: weight = (PYQ
  frequency, diminishing returns) \u00d7 (weakness, but never fully zero). Weak
  + high-yield topics dominate; a mastered topic still shows up occasionally
  — at its now-higher tier, which is what actually keeps a strong area
  strong instead of just never touching it again.
- **PYQ vs. model-question mix** is tier-dependent (70% PYQ at tier 1, down
  to 15% at tier 3) — tier 3 is specifically "tougher than a typical PYQ,"
  and there are only so many real questions that qualify, so tier 3 leans on
  generated ones by design.

All of this is pure and tested with a seeded RNG (see the build transcript /
git history for the test run) — no DB, no network, so you can re-verify or
extend it with `node` directly.

## AI grading — what it is and isn't

`lib/ai/grade.js` calls Claude (Haiku 4.5, for cost) with a rubric prompt and
parses a structured score + feedback. Treat this as **a practice aid, not an
authoritative UPSC score** — an LLM grading a law essay can misjudge nuance,
and can be wrong about whether an exact citation is correct. The prompt
explicitly tells the model to flag citations it isn't confident about rather
than assert they're wrong, and the UI carries a permanent disclaimer for the
same reason VidhiOS's exam mode disclaims its self-check. Don't let a low
score alone convince you an answer was bad, or a high score alone convince
you it was exam-ready — read the actual feedback.

## Why sources are a curated registry, not an autonomous crawler

The brief asked for something that "scans and downloads govt and official
sources." What's actually built is a **registry you (or I, in a follow-up
pass) add specific URLs to**, plus a fetch-and-cache pipeline that pulls and
extracts text from exactly those URLs, on demand or on a weekly cron. It is
*not* a crawler that goes and discovers new URLs on its own. Three reasons:

1. **Reliability** — government/UN site structures change without notice;
   an autonomous crawler silently drifts and starts feeding garbage into
   your AI prompts with no signal that it happened. A registry fails loudly
   (`status: "error"` on the exact row) instead.
2. **I couldn't test it live** — the sandbox this was built in has no
   outbound network from its code-execution tool, so nothing here could be
   exercised against a real government site before being handed to you.
   Every URL currently in `db/seed/sources.js` was individually looked up
   and confirmed live during the build (via a separate tool with real web
   access) — that's a materially different confidence level than code that
   merely *looks* correct.
3. **Staying unambiguously on the safe side of source terms of use** —
   India Code, the UN, and NALSA are first-party government/international
   sources meant for public reading. Some other UPSC-relevant sources (case
   law aggregators, some private research sites) have murkier redistribution
   terms; the registry pattern means *you* decide what goes in, rather than
   the app deciding for you.

The current seed batch covers 14 of the highest-PYQ-frequency subtopics
(`db/seed/sources.js`). The other ~65 start empty — add rows following the
same pattern, or ask me to do another verified research pass.

**One fact worth knowing regardless of this app:** since 1 July 2024 the
Bharatiya Nyaya Sanhita (BNS) has replaced the Indian Penal Code. The 2023-24
PYQs in this app were written under IPC section numbers; the Law of Crimes
sources here point at BNS (current law) on purpose. An answer that only
cites old IPC sections is technically citing repealed law — worth keeping in
mind independent of anything this tool does.

## What a "v1" means here

This is a working foundation, not a finished product: the adaptive engine,
grading, generation, and fetch pipeline are real and tested where they could
be; the UI is functional but plain (no attempt made at VidhiOS's level of
visual polish, given the scope already spent on the backend); most subtopics
have no sources yet; and nothing in `app/` or the DB-touching API routes
could be executed end-to-end before handing this to you, since that needs a
real Postgres connection and a real Anthropic API key. Smoke-test the list in
the README before trusting it with real prep time.
