// db/seed/gs1-syllabus.js
//
// GS Paper I's real UPSC syllabus (Indian Heritage and Culture, History and
// Geography of the World and Society), broken into learnable subtopics and
// grouped into six broad themes -- same structure convention as
// db/seed/gs2-syllabus.js and db/seed/gs3-syllabus.js. Every topicText
// below reproduces the official syllabus wording, which is stable,
// well-documented public information safe to transcribe directly.
//
// pyqFrequency is 0 for every row here, same deliberate choice as GS3's
// seed -- a syllabus heading is safe to reproduce, but the exact text/year/
// marks of a specific past exam question is not something to invent from
// memory (see lib/subjects/config.js's ANTI_HALLUCINATION_NOTE). Real GS1
// PYQs should be added the same way db/seed/gs2-pyqs.js was -- transcribed
// and verified against real past papers, not authored here.
export const gs1SyllabusSeed = [
  // Indian Heritage and Culture
  { id: "gs1-c1", subjectId: "gs1", paper: 1, section: "Indian Heritage and Culture", topicText: "Salient aspects of Art Forms of India, from ancient to modern times", pyqFrequency: 0 },
  { id: "gs1-c2", subjectId: "gs1", paper: 1, section: "Indian Heritage and Culture", topicText: "Literature of India, from ancient to modern times", pyqFrequency: 0 },
  { id: "gs1-c3", subjectId: "gs1", paper: 1, section: "Indian Heritage and Culture", topicText: "Architecture of India, from ancient to modern times", pyqFrequency: 0 },

  // Modern Indian History
  {
    id: "gs1-h1",
    subjectId: "gs1",
    paper: 1,
    section: "Modern Indian History",
    topicText: "Modern Indian history from about the middle of the eighteenth century until the present — significant events, personalities, issues",
    pyqFrequency: 0,
  },
  {
    id: "gs1-h2",
    subjectId: "gs1",
    paper: 1,
    section: "Modern Indian History",
    topicText: "The Freedom Struggle — its various stages and important contributors/contributions from different parts of the country",
    pyqFrequency: 0,
  },
  { id: "gs1-h3", subjectId: "gs1", paper: 1, section: "Modern Indian History", topicText: "Post-independence consolidation and reorganization within the country", pyqFrequency: 0 },

  // World History
  { id: "gs1-wh1", subjectId: "gs1", paper: 1, section: "World History", topicText: "The Industrial Revolution", pyqFrequency: 0 },
  { id: "gs1-wh2", subjectId: "gs1", paper: 1, section: "World History", topicText: "The World Wars", pyqFrequency: 0 },
  { id: "gs1-wh3", subjectId: "gs1", paper: 1, section: "World History", topicText: "Redrawal of national boundaries", pyqFrequency: 0 },
  { id: "gs1-wh4", subjectId: "gs1", paper: 1, section: "World History", topicText: "Colonization and decolonization", pyqFrequency: 0 },
  {
    id: "gs1-wh5",
    subjectId: "gs1",
    paper: 1,
    section: "World History",
    topicText: "Political philosophies like communism, capitalism, socialism etc. — their forms and effect on the society",
    pyqFrequency: 0,
  },

  // Indian Society
  { id: "gs1-s1", subjectId: "gs1", paper: 1, section: "Indian Society", topicText: "Salient features of Indian Society, Diversity of India", pyqFrequency: 0 },
  { id: "gs1-s2", subjectId: "gs1", paper: 1, section: "Indian Society", topicText: "Role of women and women's organizations", pyqFrequency: 0 },
  { id: "gs1-s3", subjectId: "gs1", paper: 1, section: "Indian Society", topicText: "Population and associated issues", pyqFrequency: 0 },
  { id: "gs1-s4", subjectId: "gs1", paper: 1, section: "Indian Society", topicText: "Poverty and developmental issues", pyqFrequency: 0 },
  { id: "gs1-s5", subjectId: "gs1", paper: 1, section: "Indian Society", topicText: "Urbanization — problems and remedies", pyqFrequency: 0 },
  { id: "gs1-s6", subjectId: "gs1", paper: 1, section: "Indian Society", topicText: "Effects of globalization on Indian society", pyqFrequency: 0 },
  { id: "gs1-s7", subjectId: "gs1", paper: 1, section: "Indian Society", topicText: "Social empowerment", pyqFrequency: 0 },
  { id: "gs1-s8", subjectId: "gs1", paper: 1, section: "Indian Society", topicText: "Communalism, regionalism and secularism", pyqFrequency: 0 },

  // Geography -- Physical and Resources
  { id: "gs1-g1", subjectId: "gs1", paper: 1, section: "Geography — Physical and Resources", topicText: "Salient features of world's physical geography", pyqFrequency: 0 },
  {
    id: "gs1-g2",
    subjectId: "gs1",
    paper: 1,
    section: "Geography — Physical and Resources",
    topicText: "Distribution of key natural resources across the world (including South Asia and the Indian sub-continent)",
    pyqFrequency: 0,
  },
  {
    id: "gs1-g3",
    subjectId: "gs1",
    paper: 1,
    section: "Geography — Physical and Resources",
    topicText: "Factors responsible for the location of primary, secondary, and tertiary sector industries in various parts of the world (including India)",
    pyqFrequency: 0,
  },

  // Geography -- Geophysical Phenomena
  {
    id: "gs1-g4",
    subjectId: "gs1",
    paper: 1,
    section: "Geography — Geophysical Phenomena",
    topicText: "Important geophysical phenomena such as earthquakes, tsunami, volcanic activity, cyclones etc.",
    pyqFrequency: 0,
  },
  {
    id: "gs1-g5",
    subjectId: "gs1",
    paper: 1,
    section: "Geography — Geophysical Phenomena",
    topicText: "Geographical features and their location — changes in critical geographical features (including water-bodies and ice-caps) and in flora and fauna, and the effects of such changes",
    pyqFrequency: 0,
  },
];
