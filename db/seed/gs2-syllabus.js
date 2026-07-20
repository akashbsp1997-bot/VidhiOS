// db/seed/gs2-syllabus.js
//
// GS Paper II ("Governance, Constitution, Polity, Social Justice and
// International relations") syllabus taxonomy -- 20 subtopics, each mapped
// 1:1 to one of UPSC's 20 official syllabus line items, verbatim from the
// current Civil Services Examination notification (Notif-CSP-2026-Engl-
// 060226Rev.pdf, Section III "SYLLABI FOR THE EXAMINATION", Part B - Main
// Examination, pages 33-37), fetched directly from upsc.gov.in.
//
// `pyqFrequency` is a real count of how many of the 220 PYQs in
// gs2-pyqs.js are tagged to each subtopic (computed directly from that
// file, not estimated) -- refresh it if gs2-pyqs.js's tagging changes.
//
// `paper` is 1 uniformly: GS Paper II is a single paper, not a two-paper
// subject the way Law Optional is; this field is schema-compatibility only
// for this subject, not semantically meaningful. `section` groups the 20
// items into the three thematic clusters the syllabus's own topic order
// falls into (Constitution/Polity institutions, Governance/Social Justice,
// International Relations) for dashboard display.
export const gs2SyllabusSeed = [
  { id: "gs2-c1", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Indian Constitution — historical underpinnings, evolution, features, amendments, significant provisions and basic structure", pyqFrequency: 18 },
  { id: "gs2-c2", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Union-State functions and responsibilities — federal structure, devolution of powers and finances to local levels", pyqFrequency: 24 },
  { id: "gs2-c3", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Separation of powers between organs — dispute redressal mechanisms and institutions", pyqFrequency: 5 },
  { id: "gs2-c4", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Comparison of the Indian constitutional scheme with other countries", pyqFrequency: 8 },
  { id: "gs2-c5", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Parliament and State legislatures — structure, functioning, conduct of business, powers and privileges", pyqFrequency: 14 },
  { id: "gs2-c6", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Executive and Judiciary — structure, organization and functioning; pressure groups and formal/informal associations", pyqFrequency: 9 },
  { id: "gs2-c7", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Salient features of the Representation of the People's Act", pyqFrequency: 9 },
  { id: "gs2-c8", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Appointment to various Constitutional posts — powers, functions and responsibilities of Constitutional Bodies", pyqFrequency: 6 },
  { id: "gs2-c9", subjectId: "gs2", paper: 1, section: "Constitution, Polity and Governance Institutions", topicText: "Statutory, regulatory and various quasi-judicial bodies", pyqFrequency: 16 },
  { id: "gs2-g1", subjectId: "gs2", paper: 1, section: "Governance, Social Justice and Welfare", topicText: "Government policies and interventions for development in various sectors, and issues arising out of their design and implementation", pyqFrequency: 8 },
  { id: "gs2-g2", subjectId: "gs2", paper: 1, section: "Governance, Social Justice and Welfare", topicText: "Development processes and the development industry — role of NGOs, SHGs, donors, charities and other stakeholders", pyqFrequency: 12 },
  { id: "gs2-g3", subjectId: "gs2", paper: 1, section: "Governance, Social Justice and Welfare", topicText: "Welfare schemes for vulnerable sections by the Centre and States — mechanisms, laws, institutions and Bodies for their protection and betterment", pyqFrequency: 8 },
  { id: "gs2-g4", subjectId: "gs2", paper: 1, section: "Governance, Social Justice and Welfare", topicText: "Development and management of Social Sector/Services — Health, Education, Human Resources", pyqFrequency: 14 },
  { id: "gs2-g5", subjectId: "gs2", paper: 1, section: "Governance, Social Justice and Welfare", topicText: "Issues relating to poverty and hunger", pyqFrequency: 8 },
  { id: "gs2-g6", subjectId: "gs2", paper: 1, section: "Governance, Social Justice and Welfare", topicText: "Governance, transparency and accountability — e-governance, citizens charters, institutional measures", pyqFrequency: 13 },
  { id: "gs2-g7", subjectId: "gs2", paper: 1, section: "Governance, Social Justice and Welfare", topicText: "Role of civil services in a democracy", pyqFrequency: 4 },
  { id: "gs2-ir1", subjectId: "gs2", paper: 1, section: "International Relations", topicText: "India and its neighbourhood — relations", pyqFrequency: 5 },
  { id: "gs2-ir2", subjectId: "gs2", paper: 1, section: "International Relations", topicText: "Bilateral, regional and global groupings and agreements involving India and/or affecting India's interests", pyqFrequency: 24 },
  { id: "gs2-ir3", subjectId: "gs2", paper: 1, section: "International Relations", topicText: "Effect of policies and politics of developed and developing countries on India's interests; Indian diaspora", pyqFrequency: 6 },
  { id: "gs2-ir4", subjectId: "gs2", paper: 1, section: "International Relations", topicText: "Important International institutions, agencies and fora — structure, mandate", pyqFrequency: 9 },
];
