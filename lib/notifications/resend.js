// lib/notifications/resend.js
//
// Thin wrapper around Resend's email API (https://resend.com) -- opt-in,
// same "zero behavior change if unset" convention as lib/ai/client.js's
// Groq fallback. Callers should check process.env.RESEND_API_KEY
// themselves before calling sendEmail (this file doesn't no-op silently,
// it throws, so a misconfiguration is loud rather than a quietly-dropped
// email).

const RESEND_API_URL = "https://api.resend.com/emails";
// Resend's own shared test sender -- works without verifying a custom
// domain, at the tradeoff of arriving as "onboarding@resend.dev" rather
// than a project-branded address. Override with RESEND_FROM_EMAIL once a
// real domain is verified in the Resend dashboard.
const DEFAULT_FROM = "VidhiOS Adaptive <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend API returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}
