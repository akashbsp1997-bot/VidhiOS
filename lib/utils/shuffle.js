// lib/utils/shuffle.js
//
// Plain Fisher-Yates shuffle -- shared by every call site that needs a
// randomized order (AI key pooling in lib/ai/client.js, and the content-reuse
// games in app/api/answer-architect/route.js and app/api/fill-blanks/route.js)
// instead of each defining its own identical copy.
export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
