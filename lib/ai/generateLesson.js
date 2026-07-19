import { callClaudeForJSON } from "./client.js";

const SYSTEM = `You are writing self-study material for a UPSC Civil Services Mains Law Optional aspirant, for ONE syllabus subtopic at a time.
Ground every legal claim, provision, or case reference ONLY in material you are highly confident is accurate, or in the source excerpts provided to you. Do not invent section numbers, case names, or citations — if unsure of an exact citation, describe the doctrine without naming an unverified case or section number.
Write for someone learning this topic for the first time, then reinforcing it, then trying to remember it long-term — three different jobs, not three copies of the same explanation.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "teachContent": "<300-500 word clear explanation of the subtopic: what it is, why it matters, the core doctrine/provisions, in plain prose paragraphs separated by \\n\\n>",
  "examples": [
    { "title": "<short label>", "body": "<a worked example or illustration applying the concept, 2-4 sentences>" }
  ],
  "exercises": [
    { "prompt": "<a short question or scenario to test understanding>", "hint": "<a one-line nudge, not the answer>", "modelAnswer": "<a concise model answer, 2-4 sentences, for self-checking>" }
  ],
  "mnemonics": [
    { "device": "<the mnemonic itself — acronym, phrase, or memory device>", "explanation": "<what each part stands for / how it maps to the content>" }
  ],
  "visualOutline": {
    "label": "<the subtopic name>",
    "children": [
      { "label": "<a major sub-concept>", "children": [ { "label": "<a detail>", "children": [] } ] }
    ]
  }
}
Provide exactly 2-3 examples, 2-3 exercises, 1-2 mnemonics, and a visualOutline 2 levels deep covering the subtopic's main sub-concepts.`;

function buildUserPrompt({ subtopicText, sourceExcerpts }) {
  const grounding = sourceExcerpts && sourceExcerpts.length
    ? `\n\nGround this in the following real source material where relevant (do not quote it at length, just keep provisions/facts accurate):\n"""\n${sourceExcerpts.join("\n---\n").slice(0, 6000)}\n"""`
    : "";
  return `Subtopic: ${subtopicText}${grounding}\n\nWrite the full lesson now. Return only the JSON object.`;
}

export async function generateLesson({ subtopicText, sourceExcerpts }) {
  const result = await callClaudeForJSON({
    system: SYSTEM,
    user: buildUserPrompt({ subtopicText, sourceExcerpts }),
    maxTokens: 2200,
  });
  return normalizeLessonResult(result);
}

function normalizeOutlineNode(node, depth = 0) {
  if (!node || typeof node !== "object" || typeof node.label !== "string") return null;
  const children = depth < 2 && Array.isArray(node.children)
    ? node.children.map((c) => normalizeOutlineNode(c, depth + 1)).filter(Boolean).slice(0, 8)
    : [];
  return { label: node.label.slice(0, 120), children };
}

export function normalizeLessonResult(raw) {
  const examples = Array.isArray(raw?.examples)
    ? raw.examples
        .filter((e) => e && typeof e.title === "string" && typeof e.body === "string")
        .slice(0, 4)
        .map((e) => ({ title: e.title.slice(0, 120), body: e.body.slice(0, 800) }))
    : [];

  const exercises = Array.isArray(raw?.exercises)
    ? raw.exercises
        .filter((e) => e && typeof e.prompt === "string")
        .slice(0, 4)
        .map((e) => ({
          prompt: e.prompt.slice(0, 500),
          hint: typeof e.hint === "string" ? e.hint.slice(0, 300) : "",
          modelAnswer: typeof e.modelAnswer === "string" ? e.modelAnswer.slice(0, 800) : "",
        }))
    : [];

  const mnemonics = Array.isArray(raw?.mnemonics)
    ? raw.mnemonics
        .filter((m) => m && typeof m.device === "string")
        .slice(0, 3)
        .map((m) => ({ device: m.device.slice(0, 300), explanation: typeof m.explanation === "string" ? m.explanation.slice(0, 500) : "" }))
    : [];

  const visualOutline = normalizeOutlineNode(raw?.visualOutline) || { label: "Overview", children: [] };

  const teachContent = typeof raw?.teachContent === "string" ? raw.teachContent.trim() : "";
  if (!teachContent) {
    throw new Error("Model did not return usable teachContent");
  }

  return { teachContent: teachContent.slice(0, 4000), examples, exercises, mnemonics, visualOutline };
}
