// db/seed/gs3-syllabus.js
//
// GS Paper III's real UPSC syllabus, broken into learnable subtopics and
// grouped into the six broad themes the syllabus itself falls into (Indian
// Economy, Agriculture, Industry and Infrastructure, Science and
// Technology, Environment and Disaster Management, Internal Security) --
// same structure convention as db/seed/gs2-syllabus.js. Every topicText
// below reproduces the official syllabus wording, which is stable,
// well-documented public information safe to transcribe directly.
//
// pyqFrequency is 0 for every row here, unlike gs2-syllabus.js's real
// PYQ-derived counts -- deliberately NOT fabricated. This session's own
// anti-hallucination discipline (see lib/subjects/config.js's
// ANTI_HALLUCINATION_NOTE) applies here too: a syllabus heading is safe to
// reproduce, but the exact text/year/marks of a specific past exam question
// is not something to invent from memory. Real GS3 PYQs should be added the
// same way db/seed/gs2-pyqs.js was -- transcribed and verified against real
// past papers, not authored here. Until then, Teach/Practice/Test content
// for GS3 subtopics is entirely AI-generated (see lib/ai/generateQuestion.js),
// same as any subtopic with fewer than 2 real PYQs already works today.
export const gs3SyllabusSeed = [
  // Indian Economy -- Growth, Development and Employment
  {
    id: "gs3-e1",
    subjectId: "gs3",
    paper: 1,
    section: "Indian Economy — Growth, Development and Employment",
    topicText: "Indian economy — planning, mobilization of resources, growth, development and employment",
    pyqFrequency: 0,
  },
  { id: "gs3-e2", subjectId: "gs3", paper: 1, section: "Indian Economy — Growth, Development and Employment", topicText: "Inclusive growth and issues arising from it", pyqFrequency: 0 },
  { id: "gs3-e3", subjectId: "gs3", paper: 1, section: "Indian Economy — Growth, Development and Employment", topicText: "Government budgeting", pyqFrequency: 0 },

  // Agriculture
  { id: "gs3-a1", subjectId: "gs3", paper: 1, section: "Agriculture", topicText: "Major crops, cropping patterns, irrigation systems", pyqFrequency: 0 },
  {
    id: "gs3-a2",
    subjectId: "gs3",
    paper: 1,
    section: "Agriculture",
    topicText: "Storage, transport and marketing of agricultural produce and issues and related constraints",
    pyqFrequency: 0,
  },
  { id: "gs3-a3", subjectId: "gs3", paper: 1, section: "Agriculture", topicText: "E-technology in the aid of farmers", pyqFrequency: 0 },
  {
    id: "gs3-a4",
    subjectId: "gs3",
    paper: 1,
    section: "Agriculture",
    topicText: "Direct and indirect farm subsidies, minimum support prices, public distribution system, buffer stocks and food security",
    pyqFrequency: 0,
  },
  { id: "gs3-a5", subjectId: "gs3", paper: 1, section: "Agriculture", topicText: "Technology missions and economics of animal-rearing", pyqFrequency: 0 },
  {
    id: "gs3-a6",
    subjectId: "gs3",
    paper: 1,
    section: "Agriculture",
    topicText: "Food processing and related industries in India — scope, significance, location, upstream and downstream requirements, supply chain management",
    pyqFrequency: 0,
  },
  { id: "gs3-a7", subjectId: "gs3", paper: 1, section: "Agriculture", topicText: "Land reforms in India", pyqFrequency: 0 },

  // Industry and Infrastructure
  {
    id: "gs3-i1",
    subjectId: "gs3",
    paper: 1,
    section: "Industry and Infrastructure",
    topicText: "Effects of liberalization on the economy, changes in industrial policy and their effects on industrial growth",
    pyqFrequency: 0,
  },
  { id: "gs3-i2", subjectId: "gs3", paper: 1, section: "Industry and Infrastructure", topicText: "Infrastructure — energy, ports, roads, airports, railways, etc.", pyqFrequency: 0 },
  { id: "gs3-i3", subjectId: "gs3", paper: 1, section: "Industry and Infrastructure", topicText: "Investment models", pyqFrequency: 0 },

  // Science and Technology
  { id: "gs3-st1", subjectId: "gs3", paper: 1, section: "Science and Technology", topicText: "Developments and their applications and effects in everyday life", pyqFrequency: 0 },
  {
    id: "gs3-st2",
    subjectId: "gs3",
    paper: 1,
    section: "Science and Technology",
    topicText: "Achievements of Indians in science and technology; indigenization of technology and developing new technology",
    pyqFrequency: 0,
  },
  {
    id: "gs3-st3",
    subjectId: "gs3",
    paper: 1,
    section: "Science and Technology",
    topicText: "Awareness in the fields of IT, space, computers, robotics, nano-technology, bio-technology and issues relating to intellectual property rights",
    pyqFrequency: 0,
  },

  // Environment and Disaster Management
  {
    id: "gs3-env1",
    subjectId: "gs3",
    paper: 1,
    section: "Environment and Disaster Management",
    topicText: "Conservation, environmental pollution and degradation, environmental impact assessment",
    pyqFrequency: 0,
  },
  { id: "gs3-env2", subjectId: "gs3", paper: 1, section: "Environment and Disaster Management", topicText: "Disaster and disaster management", pyqFrequency: 0 },

  // Internal Security
  { id: "gs3-sec1", subjectId: "gs3", paper: 1, section: "Internal Security", topicText: "Linkages between development and spread of extremism", pyqFrequency: 0 },
  {
    id: "gs3-sec2",
    subjectId: "gs3",
    paper: 1,
    section: "Internal Security",
    topicText: "Role of external state and non-state actors in creating challenges to internal security",
    pyqFrequency: 0,
  },
  {
    id: "gs3-sec3",
    subjectId: "gs3",
    paper: 1,
    section: "Internal Security",
    topicText: "Challenges to internal security through communication networks, role of media and social networking sites in internal security challenges, basics of cyber security",
    pyqFrequency: 0,
  },
  { id: "gs3-sec4", subjectId: "gs3", paper: 1, section: "Internal Security", topicText: "Money-laundering and its prevention", pyqFrequency: 0 },
  {
    id: "gs3-sec5",
    subjectId: "gs3",
    paper: 1,
    section: "Internal Security",
    topicText: "Security challenges and their management in border areas; linkages of organized crime with terrorism",
    pyqFrequency: 0,
  },
  { id: "gs3-sec6", subjectId: "gs3", paper: 1, section: "Internal Security", topicText: "Various security forces and agencies and their mandate", pyqFrequency: 0 },
];
