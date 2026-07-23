// db/seed/gs4-syllabus.js
//
// GS Paper IV's real UPSC syllabus (Ethics, Integrity and Aptitude), broken
// into learnable subtopics and grouped into four broad themes -- same
// structure convention as db/seed/gs1-syllabus.js/gs3-syllabus.js. Every
// topicText below reproduces the official syllabus wording. "Case Studies
// on above issues" (the syllabus's own closing line) isn't modeled as its
// own subtopic -- it's a question-FORMAT note (GS4 answers are often
// case-study-based), not a content topic, so it doesn't fit this taxonomy
// any more than it would for any other paper's essay-style questions.
//
// pyqFrequency is 0 for every row here, same deliberate choice as GS1/GS3's
// seeds -- a syllabus heading is safe to reproduce, but the exact text/
// year/marks of a specific past exam question is not something to invent
// from memory (see lib/subjects/config.js's ANTI_HALLUCINATION_NOTE). Real
// GS4 PYQs should be added the same way db/seed/gs2-pyqs.js was --
// transcribed and verified against real past papers, not authored here.
export const gs4SyllabusSeed = [
  // Ethics and Human Interface
  { id: "gs4-e1", subjectId: "gs4", paper: 1, section: "Ethics and Human Interface", topicText: "Essence, determinants and consequences of Ethics in human actions", pyqFrequency: 0 },
  { id: "gs4-e2", subjectId: "gs4", paper: 1, section: "Ethics and Human Interface", topicText: "Dimensions of ethics", pyqFrequency: 0 },
  { id: "gs4-e3", subjectId: "gs4", paper: 1, section: "Ethics and Human Interface", topicText: "Ethics in private and public relationships", pyqFrequency: 0 },
  {
    id: "gs4-e4",
    subjectId: "gs4",
    paper: 1,
    section: "Ethics and Human Interface",
    topicText: "Human Values — lessons from the lives and teachings of great leaders, reformers and administrators",
    pyqFrequency: 0,
  },
  { id: "gs4-e5", subjectId: "gs4", paper: 1, section: "Ethics and Human Interface", topicText: "Role of family, society and educational institutions in inculcating values", pyqFrequency: 0 },
  {
    id: "gs4-e6",
    subjectId: "gs4",
    paper: 1,
    section: "Ethics and Human Interface",
    topicText: "Attitude — content, structure, function; its influence and relation with thought and behaviour",
    pyqFrequency: 0,
  },
  { id: "gs4-e7", subjectId: "gs4", paper: 1, section: "Ethics and Human Interface", topicText: "Moral and political attitudes; social influence and persuasion", pyqFrequency: 0 },

  // Aptitude and Foundational Values for Civil Service
  {
    id: "gs4-a1",
    subjectId: "gs4",
    paper: 1,
    section: "Aptitude and Foundational Values for Civil Service",
    topicText: "Integrity, impartiality and non-partisanship, objectivity",
    pyqFrequency: 0,
  },
  {
    id: "gs4-a2",
    subjectId: "gs4",
    paper: 1,
    section: "Aptitude and Foundational Values for Civil Service",
    topicText: "Dedication to public service, empathy, tolerance and compassion towards the weaker sections",
    pyqFrequency: 0,
  },
  {
    id: "gs4-a3",
    subjectId: "gs4",
    paper: 1,
    section: "Aptitude and Foundational Values for Civil Service",
    topicText: "Emotional intelligence — concepts, utilities and application in administration and governance",
    pyqFrequency: 0,
  },
  {
    id: "gs4-a4",
    subjectId: "gs4",
    paper: 1,
    section: "Aptitude and Foundational Values for Civil Service",
    topicText: "Contributions of moral thinkers and philosophers from India and the world",
    pyqFrequency: 0,
  },

  // Public Service Values and Ethics in Governance
  { id: "gs4-g1", subjectId: "gs4", paper: 1, section: "Public Service Values and Ethics in Governance", topicText: "Status and problems of ethics in public administration", pyqFrequency: 0 },
  {
    id: "gs4-g2",
    subjectId: "gs4",
    paper: 1,
    section: "Public Service Values and Ethics in Governance",
    topicText: "Ethical concerns and dilemmas in government and private institutions",
    pyqFrequency: 0,
  },
  {
    id: "gs4-g3",
    subjectId: "gs4",
    paper: 1,
    section: "Public Service Values and Ethics in Governance",
    topicText: "Laws, rules, regulations and conscience as sources of ethical guidance",
    pyqFrequency: 0,
  },
  {
    id: "gs4-g4",
    subjectId: "gs4",
    paper: 1,
    section: "Public Service Values and Ethics in Governance",
    topicText: "Accountability and ethical governance; strengthening of ethical and moral values in governance",
    pyqFrequency: 0,
  },
  {
    id: "gs4-g5",
    subjectId: "gs4",
    paper: 1,
    section: "Public Service Values and Ethics in Governance",
    topicText: "Ethical issues in international relations and funding; corporate governance",
    pyqFrequency: 0,
  },

  // Probity in Governance
  { id: "gs4-p1", subjectId: "gs4", paper: 1, section: "Probity in Governance", topicText: "Concept of public service; philosophical basis of governance and probity", pyqFrequency: 0 },
  { id: "gs4-p2", subjectId: "gs4", paper: 1, section: "Probity in Governance", topicText: "Information sharing and transparency in government, Right to Information", pyqFrequency: 0 },
  { id: "gs4-p3", subjectId: "gs4", paper: 1, section: "Probity in Governance", topicText: "Codes of Ethics, Codes of Conduct, Citizen's Charters", pyqFrequency: 0 },
  { id: "gs4-p4", subjectId: "gs4", paper: 1, section: "Probity in Governance", topicText: "Work culture, quality of service delivery, utilization of public funds", pyqFrequency: 0 },
  { id: "gs4-p5", subjectId: "gs4", paper: 1, section: "Probity in Governance", topicText: "Challenges of corruption", pyqFrequency: 0 },
];
