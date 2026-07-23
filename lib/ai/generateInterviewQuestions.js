// lib/ai/generateInterviewQuestions.js
//
// Generates a realistic UPSC Personality Test (interview) mock question
// set, grounded in the candidate's own stated DAF-style background and
// optional subject. Deliberately does NOT grade typed answers the way
// descriptive practice does -- a real interview is evaluated on demeanor
// and spoken delivery, not just content, so pretending an AI score means
// anything here would be more misleading than useful. This just gives a
// realistic question set to rehearse against.

import { callClaudeForJSON } from "./client.js";
import { ANTI_HALLUCINATION_NOTE } from "../subjects/config.js";

const CATEGORIES = ["background", "optional", "current-affairs", "situational"];

function buildSystem() {
  return `You are simulating a UPSC Civil Services Personality Test (interview) panel. Generate realistic DAF-based interview questions in the exact register real UPSC boards use -- a mix of background/DAF questions (hometown, education, work experience, hobbies), optional-subject questions, current-affairs/opinion questions, and situational/hypothetical questions.
${ANTI_HALLUCINATION_NOTE}

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "questions": [
    { "category": "background" | "optional" | "current-affairs" | "situational", "question": "<the question>" }
  ]
}
Return 6-8 questions total, a realistic mix across all four categories.`;
}

function buildUserPrompt({ profile, optionalSubjectName, recentHeadlines }) {
  const headlinesBlock = recentHeadlines?.length ? `\n\nRecent current-affairs headlines the candidate may be asked about:\n${recentHeadlines.map((h) => `- ${h}`).join("\n")}` : "";
  return `Candidate background:
Hometown: ${profile.hometown || "(not given)"}
Education: ${profile.education || "(not given)"}
Work experience: ${profile.workExperience || "(not given)"}
Hobbies/interests: ${profile.hobbies || "(not given)"}
Service preference: ${profile.servicePreference || "(not given)"}
Optional subject: ${optionalSubjectName || "(not given)"}${headlinesBlock}

Generate the mock interview question set now. Return only the JSON object.`;
}

export async function generateInterviewQuestions({ profile, optionalSubjectName, recentHeadlines }) {
  const result = await callClaudeForJSON({
    system: buildSystem(),
    user: buildUserPrompt({ profile, optionalSubjectName, recentHeadlines }),
    maxTokens: 2000,
  });
  return normalizeResult(result);
}

export function normalizeResult(raw) {
  const questions = Array.isArray(raw?.questions)
    ? raw.questions
        .filter((q) => q && typeof q.question === "string" && q.question.trim())
        .slice(0, 10)
        .map((q) => ({ category: CATEGORIES.includes(q.category) ? q.category : "background", question: q.question.trim().slice(0, 400) }))
    : [];
  if (!questions.length) throw new Error("Model did not return a usable interview question set");
  return questions;
}
