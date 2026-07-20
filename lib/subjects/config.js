// lib/subjects/config.js
//
// Per-subject "content contract" for the AI prompt builders in lib/ai/*.js.
// Adding a new subject (a GS paper, Essay, another optional) means adding an
// entry here -- and, if it needs a lesson field shape that doesn't exist yet
// (Law's keyProvisions/caseLaw won't fit every subject), a new FIELD_TEMPLATES
// entry -- not touching the prompt-builder logic in generateLesson.js,
// generateQuestion.js, or grade.js.

/**
 * Carried into every subject's prompts unchanged -- this discipline (prefer
 * an honest gap to a fabricated citation) is a cross-cutting product
 * principle per docs/ARCHITECTURE.md, not a per-subject choice.
 */
export const ANTI_HALLUCINATION_NOTE =
  "Do not invent section numbers, case names, dates, statistics, or citations. It is completely fine to return fewer entries than the format allows, or to describe a concept without naming an unverified source, rather than fabricate one -- an honest gap is better than a wrong citation.";

/**
 * Structured lesson fields a subject's CORE_SYSTEM prompt can ask for,
 * beyond the universal teachContent. Each entry supplies the JSON-shape
 * snippet to splice into the prompt and a plain-language count guidance
 * string. Keep field names matching real db/schema.js `lessons` columns
 * (keyProvisions, caseLaw) -- normalizeCoreResult iterates
 * subjectConfig.lessonSchema.structuredFields against this registry, so a
 * new subject wanting different fields needs a new column too (see the
 * plan's note on the generic `structuredFields` jsonb column for anything
 * that doesn't already have a named column).
 */
export const FIELD_TEMPLATES = {
  keyProvisions: {
    schemaBlock: `"keyProvisions": [
    { "citation": "<e.g. 'Article 21' or 'Section 3, BNS 2023'>", "summary": "<1-2 sentence plain-language summary of what it says>" }
  ]`,
    countGuidance: "4-6 keyProvisions entries",
    normalize: (raw) =>
      Array.isArray(raw)
        ? raw
            .filter((p) => p && typeof p.citation === "string" && typeof p.summary === "string")
            .slice(0, 8)
            .map((p) => ({ citation: p.citation.slice(0, 120), summary: p.summary.slice(0, 400) }))
        : [],
  },
  caseLaw: {
    schemaBlock: `"caseLaw": [
    { "case": "<Case Name v. Case Name (Year)>", "facts": "<2-4 sentences, the material facts>", "holding": "<2-3 sentences, what the court actually decided>", "significance": "<1-2 sentences, why this case matters for this subtopic and how to invoke it in an answer>" }
  ]`,
    countGuidance: "2-4 caseLaw entries",
    extraGroundingHint:
      "If a verified case list is provided, prefer those cases and build accurate facts/holding/significance around them; you may add 1-2 other well-known cases only if you are highly confident.",
    normalize: (raw) =>
      Array.isArray(raw)
        ? raw
            .filter((c) => c && typeof c.case === "string")
            .slice(0, 5)
            .map((c) => ({
              case: c.case.slice(0, 150),
              facts: typeof c.facts === "string" ? c.facts.slice(0, 600) : "",
              holding: typeof c.holding === "string" ? c.holding.slice(0, 500) : "",
              significance: typeof c.significance === "string" ? c.significance.slice(0, 400) : "",
            }))
        : [],
  },
};

export const SUBJECT_CONFIGS = {
  "law-optional": {
    examLabel: "UPSC Civil Services Mains Law Optional",
    answerFormat: "descriptive",
    lessonSchema: { structuredFields: ["keyProvisions", "caseLaw"] },
    gradingRubricNotes:
      "reward correct legal reasoning, accurate provisions/case law, structure (issue-rule-application-conclusion), and analytical depth appropriate to the marks. Penalise factual/legal errors, missing the actual question asked, and thin or generic answers.\nIf the candidate cites a specific Article, Section, Act, or case name, judge it only if you are confident of its accuracy; if you are not confident, say so in \"weaknesses\" rather than asserting it is wrong.",
    feedbackExtraFields: ["missedProvisions"],
  },
  gs2: {
    examLabel: "UPSC Civil Services Mains GS Paper II (Governance, Constitution, Polity, Social Justice and International Relations)",
    answerFormat: "descriptive",
    // keyProvisions/caseLaw fit GS-II well as-is (constitutional Articles/
    // Amendments/Acts, and landmark Supreme Court judgments on polity
    // questions come up directly in real PYQs -- see db/seed/gs2-pyqs.js,
    // e.g. 2022 Q1, 2023 Q11/Q12) -- no new FIELD_TEMPLATES entry needed.
    lessonSchema: { structuredFields: ["keyProvisions", "caseLaw"] },
    gradingRubricNotes:
      "reward accurate constitutional/statutory grounding, clear multi-dimensional analysis (political, social, economic and administrative angles as relevant to the question), structure (brief intro, organized body, forward-looking conclusion), and use of relevant recent examples. Penalise factual/constitutional errors, missing the actual question's directive (e.g. 'critically examine' vs 'discuss'), and thin or generic answers.\nIf the candidate cites a specific Article, Act, Amendment, or case name, judge it only if you are confident of its accuracy; if you are not confident, say so in \"weaknesses\" rather than asserting it is wrong.",
    feedbackExtraFields: ["missedProvisions"],
  },
};

export function getSubjectConfig(subjectId) {
  const config = SUBJECT_CONFIGS[subjectId];
  if (!config) {
    throw new Error(`No SUBJECT_CONFIGS entry for subjectId "${subjectId}" -- add one to lib/subjects/config.js.`);
  }
  return config;
}

export function getFieldTemplate(fieldName) {
  const template = FIELD_TEMPLATES[fieldName];
  if (!template) {
    throw new Error(`No FIELD_TEMPLATES entry for lesson field "${fieldName}" -- add one to lib/subjects/config.js.`);
  }
  return template;
}
