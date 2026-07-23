// db/seed/csat-quant-syllabus.js
//
// CSAT (Prelims Paper II) Basic Numeracy + Data Interpretation subtopics --
// the "Quant" half of CSAT (the other half -- comprehension, interpersonal
// skills, logical reasoning, decision making, general mental ability -- is
// a reasoning/comprehension test with no fixed content taxonomy to teach
// through, out of scope here, same boundary already documented in
// app/api/mcq/route.js's header).
//
// The OFFICIAL syllabus text for this section is genuinely just two lines:
// "Basic numeracy (numbers and their relations, orders of magnitude, etc.)
// (Class X level)" and "Data Interpretation (charts, graphs, tables, data
// sufficiency etc. — Class X level)". Unlike GS/optional syllabi (long lists
// of official line items safe to transcribe directly), there is no longer
// official breakdown to reproduce -- the 15 topicTexts below are a STANDARD
// decomposition of those two lines (the same one every NCERT Class 8-10 math
// curriculum and virtually every coaching resource uses), not verbatim UPSC
// wording. Flagged explicitly rather than implied, per this app's own
// anti-hallucination discipline: an honest "this is a standard breakdown,
// not official text" beats presenting it as something it isn't.
//
// subjectId "prelims-csat" already exists as a subjects row (category
// 'prelims', answerFormat 'mcq', see db/seed/subjects.js) and is ungated
// (lib/adaptive/subjectUnlocks.js's GATED_CATEGORIES doesn't include
// 'prelims') -- no unlock progression needed, same as prelims-gs/essay.
//
// pyqFrequency is 0 for every row -- real CSAT quant PYQs exist publicly,
// but sourcing them verbatim (matching the standard this app held itself to
// for db/seed/political-science-pyqs.js) is a separate future pass, not
// done here. An honest gap, not a fabricated count.
export const csatQuantSyllabusSeed = [
  // --- Basic Numeracy ---
  { id: "csat-num1", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Number System, LCM and HCF", pyqFrequency: 0 },
  { id: "csat-num2", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Simplification and Approximation", pyqFrequency: 0 },
  { id: "csat-num3", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Percentage", pyqFrequency: 0 },
  { id: "csat-num4", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Profit, Loss and Discount", pyqFrequency: 0 },
  { id: "csat-num5", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Simple Interest and Compound Interest", pyqFrequency: 0 },
  { id: "csat-num6", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Ratio, Proportion and Partnership", pyqFrequency: 0 },
  { id: "csat-num7", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Average, Mixture and Alligation", pyqFrequency: 0 },
  { id: "csat-num8", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Time and Work", pyqFrequency: 0 },
  { id: "csat-num9", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Time, Speed and Distance", pyqFrequency: 0 },
  { id: "csat-num10", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Mensuration: Area, Perimeter and Volume", pyqFrequency: 0 },
  { id: "csat-num11", subjectId: "prelims-csat", paper: 1, section: "Basic Numeracy", topicText: "Permutation, Combination and Probability", pyqFrequency: 0 },

  // --- Data Interpretation ---
  { id: "csat-di1", subjectId: "prelims-csat", paper: 1, section: "Data Interpretation", topicText: "Data Interpretation — Tables", pyqFrequency: 0 },
  { id: "csat-di2", subjectId: "prelims-csat", paper: 1, section: "Data Interpretation", topicText: "Data Interpretation — Bar and Line Graphs", pyqFrequency: 0 },
  { id: "csat-di3", subjectId: "prelims-csat", paper: 1, section: "Data Interpretation", topicText: "Data Interpretation — Pie Charts", pyqFrequency: 0 },
  { id: "csat-di4", subjectId: "prelims-csat", paper: 1, section: "Data Interpretation", topicText: "Data Sufficiency", pyqFrequency: 0 },
];
