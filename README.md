# VidhiOS Adaptive

A subtopic-by-subtopic adaptive practice engine for UPSC CSE Law Optional. One
question at a time — never a batch — and each graded answer shapes the next
question: weak, high-yield subtopics get served most often; strong ones still
resurface occasionally, at a harder tier. Built on the same 81-topic syllabus
and 168 real 2023-25 PYQs as [VidhiOS](../vidhios), its sibling offline PWA.

**Read `docs/ARCHITECTURE.md` before you dig into the code** — it explains
the adaptive algorithm, what the AI grading can and can't be trusted for, and
why the "official source scanning" is a curated registry rather than an
autonomous crawler. That context will save you time.

## What's real vs. what needs you

This was built in a sandbox with no npm registry access and no outbound
network from code execution, so:
- ✅ **Tested and verified**: the adaptive engine (mastery/tier/selection
  logic), the AI-response parsing/normalization, the HTML/text-extraction
  helpers, the 81 syllabus topics + 168 PYQs (reused from VidhiOS, already
  cross-validated), 18 hand-verified official source URLs, every file's
  syntax and every import path across the whole repo.
- ⚠️ **Written correctly but not executable here, so smoke-test after
  deploy**: anything that touches a live Postgres connection or calls the
  real OpenRouter API (i.e., most of `app/api/*`) — these are ordinary Next.js
  + Drizzle + fetch code, not exotic, but "should work" isn't "verified
  working" until it's run against your real database and key.

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Project Settings → Database → copy the **Connection pooling** string
   (port 6543, pgbouncer) — this is your `DATABASE_URL`.

## 2. Configure environment

```bash
cp .env.example .env.local
# fill in DATABASE_URL and OPENROUTER_API_KEY
```

Get an OpenRouter API key at [openrouter.ai/keys](https://openrouter.ai/keys). Text
generation (grading, questions, lessons) defaults to a free model
(`openai/gpt-oss-20b:free`), so no billing is required for that. The
diagram image generation (`google/gemini-2.5-flash-image`) is paid and needs
OpenRouter billing set up if you want it — it fails silently (no diagram, rest
of the lesson unaffected) without credits. See "Costs to expect" below.

## 3. Create tables + seed data

**No terminal needed:** after deploying (step below), visit
`https://<your-app>.vercel.app/api/setup?key=<SETUP_SECRET>` once in any
browser. It creates every table and loads the 81 subtopics / 168 PYQs / 18
starter sources. Safe to revisit — won't duplicate data.

**If you do have a terminal:**

```bash
npm install
npm run db:push     # creates all tables from db/schema.js
npm run seed        # loads 81 subtopics, 168 PYQs, 18 starter sources
```

## 4. Run locally

```bash
npm run dev
# open http://localhost:3000
```

Try: Dashboard loads with mastery bars → click "Start adaptive practice" →
a question loads → submit a short answer → confirm you get back a score and
feedback, and mastery/tier updates on the dashboard afterward. That loop
touching DB + AI successfully is the real smoke test.

## Deploy (Vercel)

```bash
vercel deploy --prod
```

Then in the Vercel project settings, add the same environment variables
(`DATABASE_URL`, `OPENROUTER_API_KEY`, `CRON_SECRET`) under **Settings →
Environment Variables**. The weekly source-refresh cron (`vercel.json`) picks
up automatically on deploy — check your plan's cron limits if you change the
schedule.

## Push to GitHub

This repo is already `git init`-ed with an initial commit (see below). To
push it:

```bash
cd vidhios-adaptive
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## Costs to expect

Every submitted answer triggers one text model call (grading); reaching a
new subtopic×tier combination for the first time triggers one more (question
generation), and the first visit to a subtopic's Teach stage triggers a
lesson generation (three text calls + one image call). Text calls default to
`openai/gpt-oss-20b:free` on OpenRouter, so expect $0 for those — free-tier
models do carry rate limits, and OpenRouter can pull a model from its free
tier entirely without notice (this happened once already — check
https://openrouter.ai/api/v1/models for current `$0`-priced entries if you
hit a 404 "unavailable for free" error), so if you hit those, swap `MODEL` in
`lib/ai/client.js` for a paid OpenRouter model (this app previously ran on
`anthropic/claude-haiku-4.5` — routing through OpenRouter doesn't make Claude
free, it just avoids Anthropic's own prepaid-billing requirement). The
diagram image call (`google/gemini-2.5-flash-image`) is priced per-image, not
per-token, and is NOT free — without OpenRouter credits it fails (silently;
the rest of the lesson still generates, just without a diagram). Keep an eye
on [openrouter.ai/activity](https://openrouter.ai/activity) if you enable it.

## Extending the source registry

`db/seed/sources.js` currently covers 14 of the ~20 highest-PYQ-frequency
subtopics. To add more:

1. Find the real, official URL (India Code for bare acts, the relevant
   ministry/court/UN site for everything else) — don't guess a URL, verify it
   loads.
2. Add a row to `db/seed/sources.js` (or insert directly via
   `npm run db:studio`'s table editor).
3. Re-run `npm run seed`, or hit "Fetch now" on that subtopic's `/sources`
   page.

## Project structure

```
db/schema.js              Drizzle schema (subtopics, sources, pyqs, model_questions, attempts, mastery)
db/seed/                  Seed data: syllabus, PYQs, starter sources
lib/adaptive/engine.js    Pure adaptive logic (mastery, tiers, selection) — unit tested
lib/ai/                   OpenRouter API client, grading, question generation
lib/sources/              Fetch + text-extraction pipeline
app/api/                  attempt (next question / grade), sources, cron
app/                      Dashboard, practice (adaptive + per-subtopic), source browser
docs/ARCHITECTURE.md      Design rationale — read this
```
