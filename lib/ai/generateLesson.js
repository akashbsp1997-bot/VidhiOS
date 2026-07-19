import { callClaudeForJSON, callImageGen } from "./client.js";

const CORE_SYSTEM = `You are writing the core self-study content for a UPSC Civil Services Mains Law Optional aspirant, for ONE syllabus subtopic. This needs to work as a STANDALONE resource — assume the reader has no textbook open besides this.
Ground every legal claim, provision, or case reference ONLY in material you are highly confident is accurate, or in the source excerpts / verified case list provided to you. Do not invent section numbers, case names, dates, or citations. If a verified case list is provided, prefer those cases and build accurate facts/holding/significance around them; you may add 1-2 other well-known cases only if you are highly confident, and it is completely fine to return FEWER cases than the format allows rather than fabricate one — an honest gap is better than a wrong citation.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "teachContent": "<800-1200 word explanation: what the concept is, its constitutional/statutory basis, how it developed, the current legal position, and why it matters — written as connected prose in paragraphs separated by \\n\\n, not bullet fragments>",
  "keyProvisions": [
    { "citation": "<e.g. 'Article 21' or 'Section 3, BNS 2023'>", "summary": "<1-2 sentence plain-language summary of what it says>" }
  ],
  "caseLaw": [
    { "case": "<Case Name v. Case Name (Year)>", "facts": "<2-4 sentences, the material facts>", "holding": "<2-3 sentences, what the court actually decided>", "significance": "<1-2 sentences, why this case matters for this subtopic and how to invoke it in an answer>" }
  ]
}
Aim for 4-6 keyProvisions and 2-4 caseLaw entries, but accuracy over count on both — especially caseLaw.`;

const PRACTICE_SYSTEM = `You are writing the practice and retention layer for a UPSC Civil Services Mains Law Optional aspirant's self-study material on ONE syllabus subtopic. You will be given the core content (explanation, provisions, case law) already written for this subtopic — build on it, stay consistent with it, do not contradict it.
Ground every legal claim ONLY in the core content given to you or material you are highly confident is accurate. Do not invent citations.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "perspectives": [
    { "angle": "<a critical viewpoint, debate, criticism, or reform proposal — OR a broader thematic/contemporary connection worth weaving into a strong answer>", "explanation": "<2-3 sentences developing it>" }
  ],
  "answerFramework": "<a short, specific paragraph (100-150 words) on how to structure a Mains answer on THIS subtopic specifically — which of the provisions/cases above to lead with, how to sequence the argument, what a 'critically discuss' vs a fact-pattern version of this question would each need>",
  "examples": [
    { "title": "<short label>", "body": "<a worked example or illustration applying the concept, 2-4 sentences>" }
  ],
  "exercises": [
    { "prompt": "<a short question or scenario to test understanding>", "hint": "<a one-line nudge, not the answer>", "modelAnswer": "<a concise model answer, 3-5 sentences, showing real structure — not just a fact statement>" }
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
Provide 3-4 perspectives, 2-3 examples, 2-3 exercises, 1-2 mnemonics, and a visualOutline 2 levels deep.`;

function buildCoreUserPrompt({ subtopicText, sourceExcerpts, caseAnchors }) {
  const grounding = sourceExcerpts && sourceExcerpts.length
    ? `\n\nGround provisions in this real source material where relevant (do not quote it at length, just keep facts accurate):\n"""\n${sourceExcerpts.join("\n---\n").slice(0, 6000)}\n"""`
    : "";
  const anchors = caseAnchors && caseAnchors.length
    ? `\n\nVerified cases known to be relevant to this subtopic (use these, expand accurate facts/holding around them):\n${caseAnchors.map((c) => `- ${c.case}: ${c.point}`).join("\n")}`
    : "";
  return `Subtopic: ${subtopicText}${grounding}${anchors}\n\nWrite the core content now. Return only the JSON object.`;
}

function buildPracticeUserPrompt({ subtopicText, core }) {
  const provisionsList = (core.keyProvisions || []).map((p) => `${p.citation}: ${p.summary}`).join("\n");
  const casesList = (core.caseLaw || []).map((c) => `${c.case}: ${c.significance}`).join("\n");
  return `Subtopic: ${subtopicText}

Core explanation already written:
"""
${core.teachContent}
"""

Key provisions already established:
${provisionsList || "(none provided)"}

Case law already established:
${casesList || "(none provided)"}

Write the practice/retention content now, consistent with the above. Return only the JSON object.`;
}

function normalizeOutlineNode(node, depth = 0) {
  if (!node || typeof node !== "object" || typeof node.label !== "string") return null;
  const children = depth < 2 && Array.isArray(node.children)
    ? node.children.map((c) => normalizeOutlineNode(c, depth + 1)).filter(Boolean).slice(0, 8)
    : [];
  return { label: node.label.slice(0, 120), children };
}

export function normalizeCoreResult(raw) {
  const keyProvisions = Array.isArray(raw?.keyProvisions)
    ? raw.keyProvisions
        .filter((p) => p && typeof p.citation === "string" && typeof p.summary === "string")
        .slice(0, 8)
        .map((p) => ({ citation: p.citation.slice(0, 120), summary: p.summary.slice(0, 400) }))
    : [];

  const caseLaw = Array.isArray(raw?.caseLaw)
    ? raw.caseLaw
        .filter((c) => c && typeof c.case === "string")
        .slice(0, 5)
        .map((c) => ({
          case: c.case.slice(0, 150),
          facts: typeof c.facts === "string" ? c.facts.slice(0, 600) : "",
          holding: typeof c.holding === "string" ? c.holding.slice(0, 500) : "",
          significance: typeof c.significance === "string" ? c.significance.slice(0, 400) : "",
        }))
    : [];

  const teachContent = typeof raw?.teachContent === "string" ? raw.teachContent.trim() : "";
  if (!teachContent) {
    throw new Error("Model did not return usable teachContent");
  }

  return { teachContent: teachContent.slice(0, 8000), keyProvisions, caseLaw };
}

export function normalizePracticeResult(raw) {
  const perspectives = Array.isArray(raw?.perspectives)
    ? raw.perspectives
        .filter((p) => p && typeof p.angle === "string")
        .slice(0, 5)
        .map((p) => ({ angle: p.angle.slice(0, 250), explanation: typeof p.explanation === "string" ? p.explanation.slice(0, 500) : "" }))
    : [];

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
          modelAnswer: typeof e.modelAnswer === "string" ? e.modelAnswer.slice(0, 900) : "",
        }))
    : [];

  const mnemonics = Array.isArray(raw?.mnemonics)
    ? raw.mnemonics
        .filter((m) => m && typeof m.device === "string")
        .slice(0, 3)
        .map((m) => ({ device: m.device.slice(0, 300), explanation: typeof m.explanation === "string" ? m.explanation.slice(0, 500) : "" }))
    : [];

  const visualOutline = normalizeOutlineNode(raw?.visualOutline) || { label: "Overview", children: [] };
  const answerFramework = typeof raw?.answerFramework === "string" ? raw.answerFramework.slice(0, 1200) : "";

  return { perspectives, answerFramework, examples, exercises, mnemonics, visualOutline };
}

export function flattenOutlineLabels(node, out = [], depth = 0) {
  if (!node) return out;
  if (depth > 0) out.push(node.label);
  (node.children || []).forEach((c) => flattenOutlineLabels(c, out, depth + 1));
  return out;
}

export function buildImagePrompt(subtopicText, visualOutline) {
  const labels = flattenOutlineLabels(visualOutline).slice(0, 6);
  return `Create a simple, clean educational diagram (flat infographic style, plain background, no photorealism) illustrating the legal concept "${subtopicText}".
Structure it as a small hierarchy or flowchart using ONLY these short labels, spelled EXACTLY as given, one per box, large and clearly legible: ${labels.map((l) => `"${l}"`).join(", ")}.
Do not add any other text, numbers, citations, or labels beyond these — keep every label short and the layout uncluttered. This is a memory aid, not a data-dense chart.`;
}

export async function generateLesson({ subtopicText, sourceExcerpts, caseAnchors }) {
  const coreRaw = await callClaudeForJSON({
    system: CORE_SYSTEM,
    user: buildCoreUserPrompt({ subtopicText, sourceExcerpts, caseAnchors }),
    maxTokens: 3500,
  });
  const core = normalizeCoreResult(coreRaw);

  const practiceRaw = await callClaudeForJSON({
    system: PRACTICE_SYSTEM,
    user: buildPracticeUserPrompt({ subtopicText, core }),
    maxTokens: 2600,
  });
  const practice = normalizePracticeResult(practiceRaw);

  let visualImageDataUri = null;
  try {
    visualImageDataUri = await callImageGen({ prompt: buildImagePrompt(subtopicText, practice.visualOutline) });
  } catch (err) {
    console.error(`Image generation failed for "${subtopicText}":`, err.message);
  }

  return { ...core, ...practice, visualImageDataUri };
}
