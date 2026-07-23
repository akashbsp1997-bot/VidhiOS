// db/seed/political-science-syllabus.js
//
// Political Science and International Relations (PSIR) Optional's real
// UPSC syllabus, broken into learnable subtopics across its five official
// sections (Paper I: Political Theory and Indian Political Thought, Indian
// Government and Politics; Paper II: Comparative Politics, International
// Relations, India and the World) -- same structure convention as
// db/seed/gs1-syllabus.js etc. Every topicText below reproduces the
// official syllabus wording (cross-checked against two independent public
// sources), which is stable, well-documented public information safe to
// transcribe directly. subjectId "political-science-optional" is already
// generated as a subject row by db/seed/subjects.js's getOptionalSubjects()
// (lib/subjects/papers.js's GENERAL_OPTIONALS already lists it) -- this
// file only adds its subtopics.
//
// pyqFrequency is 0 for every row, same deliberate choice as GS1/GS3/GS4's
// seeds, for an ADDITIONAL reason here specifically: the real past-paper
// question text I could find in public compilations during research came
// back paraphrased/summarized by the extraction tool, not verbatim quotes
// I could cross-verify character-for-character the way Essay's PYQs were
// (see db/seed/essay-topics.js) -- an honest gap is better than a
// plausible-but-unverified "real" question. Real PSIR PYQs should be added
// later once verbatim past-paper text is available, the same way
// db/seed/gs2-pyqs.js was built.
export const politicalScienceSyllabusSeed = [
  // Paper I, Section A -- Political Theory and Indian Political Thought
  { id: "psir-pt1", subjectId: "political-science-optional", paper: 1, section: "Political Theory and Indian Political Thought", topicText: "Political Theory: meaning and approaches", pyqFrequency: 0 },
  {
    id: "psir-pt2",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Political Theory and Indian Political Thought",
    topicText: "Theories of state: Liberal, Neo-liberal, Marxist, Pluralist, Post-colonial and Feminist",
    pyqFrequency: 0,
  },
  {
    id: "psir-pt3",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Political Theory and Indian Political Thought",
    topicText: "Justice: Conceptions of justice with special reference to Rawls' theory of justice and its communitarian critiques",
    pyqFrequency: 0,
  },
  {
    id: "psir-pt4",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Political Theory and Indian Political Thought",
    topicText: "Equality: Social, political and economic; relationship between equality and freedom; Affirmative action",
    pyqFrequency: 0,
  },
  {
    id: "psir-pt5",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Political Theory and Indian Political Thought",
    topicText: "Rights: Meaning and theories; different kinds of rights; concept of Human Rights",
    pyqFrequency: 0,
  },
  {
    id: "psir-pt6",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Political Theory and Indian Political Thought",
    topicText: "Democracy: Classical and contemporary theories; different models of democracy — representative, participatory and deliberative",
    pyqFrequency: 0,
  },
  { id: "psir-pt7", subjectId: "political-science-optional", paper: 1, section: "Political Theory and Indian Political Thought", topicText: "Concept of power: hegemony, ideology and legitimacy", pyqFrequency: 0 },
  {
    id: "psir-pt8",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Political Theory and Indian Political Thought",
    topicText: "Political Ideologies: Liberalism, Socialism, Marxism, Fascism, Gandhism and Feminism",
    pyqFrequency: 0,
  },
  {
    id: "psir-pt9",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Political Theory and Indian Political Thought",
    topicText: "Indian Political Thought: Dharmashastra, Arthashastra and Buddhist Traditions; Sir Syed Ahmed Khan, Sri Aurobindo, M.K. Gandhi, B.R. Ambedkar, M.N. Roy",
    pyqFrequency: 0,
  },
  {
    id: "psir-pt10",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Political Theory and Indian Political Thought",
    topicText: "Western Political Thought: Plato, Aristotle, Machiavelli, Hobbes, Locke, J.S. Mill, Marx, Gramsci, Hannah Arendt",
    pyqFrequency: 0,
  },

  // Paper I, Section B -- Indian Government and Politics
  {
    id: "psir-igp1",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Indian Nationalism: political strategies of India's freedom struggle — constitutionalism to mass Satyagraha, Non-cooperation, Civil Disobedience; different strands and perspectives",
    pyqFrequency: 0,
  },
  {
    id: "psir-igp2",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Making of the Indian Constitution: legacies of British rule; different social and political perspectives",
    pyqFrequency: 0,
  },
  {
    id: "psir-igp3",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Salient features of the Indian Constitution: basic structure, fundamental rights, directive principles, fundamental duties, parliamentary system, federal system, centre-state relations, amendment procedures, judicial review, emergency provisions",
    pyqFrequency: 0,
  },
  { id: "psir-igp4", subjectId: "political-science-optional", paper: 1, section: "Indian Government and Politics", topicText: "Principal organs of the Union Government: executive, legislature, judiciary — structure, functions, reform trends", pyqFrequency: 0 },
  { id: "psir-igp5", subjectId: "political-science-optional", paper: 1, section: "Indian Government and Politics", topicText: "Principal organs of State Government: executive, legislature, judiciary — structure, functions, reform trends", pyqFrequency: 0 },
  {
    id: "psir-igp6",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Grassroots Democracy: Panchayati Raj and Municipal Government — the 73rd and 74th Constitutional Amendments",
    pyqFrequency: 0,
  },
  {
    id: "psir-igp7",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Statutory institutions/Commissions: Election Commission, Comptroller and Auditor General, UPSC, National Commissions for SC/ST/OBC/Women/Minorities/Human Rights, Central Vigilance Commission",
    pyqFrequency: 0,
  },
  {
    id: "psir-igp8",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Federalism: constitutional provisions, changing nature of centre-state relations, integrationist tendencies, inter-state disputes",
    pyqFrequency: 0,
  },
  {
    id: "psir-igp9",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Planning and Economic Development: Nehruvian and Gandhian perspectives, liberalization and economic reforms, regional disparities",
    pyqFrequency: 0,
  },
  { id: "psir-igp10", subjectId: "political-science-optional", paper: 1, section: "Indian Government and Politics", topicText: "Caste, Religion and Ethnicity in Indian Politics", pyqFrequency: 0 },
  {
    id: "psir-igp11",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Party System: national and regional political parties, ideological and social bases of parties, patterns of coalition politics, pressure groups, trends in electoral behaviour",
    pyqFrequency: 0,
  },
  {
    id: "psir-igp12",
    subjectId: "political-science-optional",
    paper: 1,
    section: "Indian Government and Politics",
    topicText: "Social Movements: civil liberties and human rights movements, women's movements, environmentalist movements",
    pyqFrequency: 0,
  },

  // Paper II, Section A (part 1) -- Comparative Politics
  {
    id: "psir-cp1",
    subjectId: "political-science-optional",
    paper: 2,
    section: "Comparative Politics",
    topicText: "Comparative Politics: nature and major approaches; political economy and political sociology perspectives; limitations of the comparative method",
    pyqFrequency: 0,
  },
  { id: "psir-cp2", subjectId: "political-science-optional", paper: 2, section: "Comparative Politics", topicText: "State in comparative perspective: capitalist and socialist state models, post-colonial state models", pyqFrequency: 0 },
  {
    id: "psir-cp3",
    subjectId: "political-science-optional",
    paper: 2,
    section: "Comparative Politics",
    topicText: "Politics of Representation and Participation: political parties, pressure groups, social movements in comparative perspective",
    pyqFrequency: 0,
  },
  { id: "psir-cp4", subjectId: "political-science-optional", paper: 2, section: "Comparative Politics", topicText: "Globalisation: concept and effect on state autonomy; responses from developed and developing societies", pyqFrequency: 0 },

  // Paper II, Section A (part 2) -- International Relations
  {
    id: "psir-ir1",
    subjectId: "political-science-optional",
    paper: 2,
    section: "International Relations",
    topicText: "Approaches to the study of International Relations: Idealist, Realist, Marxist, Functionalist and Systems theory",
    pyqFrequency: 0,
  },
  {
    id: "psir-ir2",
    subjectId: "political-science-optional",
    paper: 2,
    section: "International Relations",
    topicText: "Key concepts in International Relations: national interest, security and power, balance of power and deterrence, transnational actors and collective security, world capitalist economy and globalisation",
    pyqFrequency: 0,
  },
  {
    id: "psir-ir3",
    subjectId: "political-science-optional",
    paper: 2,
    section: "International Relations",
    topicText: "Changing International Political Order: rise of superpowers, strategic and ideological bipolarity, Non-Aligned Movement, collapse of the Soviet Union, unipolarity and American hegemony, relevance of non-alignment today",
    pyqFrequency: 0,
  },
  { id: "psir-ir4", subjectId: "political-science-optional", paper: 2, section: "International Relations", topicText: "United Nations: envisaged role and actual record, specialized UN agencies, need for UN reforms", pyqFrequency: 0 },
  { id: "psir-ir5", subjectId: "political-science-optional", paper: 2, section: "International Relations", topicText: "Regionalisation of world politics: EU, ASEAN, APEC, SAARC, NAFTA", pyqFrequency: 0 },
  {
    id: "psir-ir6",
    subjectId: "political-science-optional",
    paper: 2,
    section: "International Relations",
    topicText: "Contemporary global concerns: democracy, human rights, environment, gender justice, terrorism, nuclear proliferation",
    pyqFrequency: 0,
  },

  // Paper II, Section B -- India and the World
  { id: "psir-iw1", subjectId: "political-science-optional", paper: 2, section: "India and the World", topicText: "Indian Foreign Policy: determinants, institutions of policy-making, continuity and change", pyqFrequency: 0 },
  {
    id: "psir-iw2",
    subjectId: "political-science-optional",
    paper: 2,
    section: "India and the World",
    topicText: "India's contribution to the Non-Alignment Movement: different phases, current relevance of non-alignment",
    pyqFrequency: 0,
  },
  { id: "psir-iw3", subjectId: "political-science-optional", paper: 2, section: "India and the World", topicText: "India's relations with major powers: US, Russia, China", pyqFrequency: 0 },
  {
    id: "psir-iw4",
    subjectId: "political-science-optional",
    paper: 2,
    section: "India and the World",
    topicText: "India and South Asia: regional cooperation (SAARC), South Asia as a Free Trade Area, India's Look East policy, impediments to regional cooperation",
    pyqFrequency: 0,
  },
  { id: "psir-iw5", subjectId: "political-science-optional", paper: 2, section: "India and the World", topicText: "India and the Global South: South-South cooperation", pyqFrequency: 0 },
  { id: "psir-iw6", subjectId: "political-science-optional", paper: 2, section: "India and the World", topicText: "India and the Global Centres of Power: US, EU, Japan, China", pyqFrequency: 0 },
  { id: "psir-iw7", subjectId: "political-science-optional", paper: 2, section: "India and the World", topicText: "India and the UN system: role in UN peace-keeping, demand for a permanent seat in the Security Council", pyqFrequency: 0 },
  { id: "psir-iw8", subjectId: "political-science-optional", paper: 2, section: "India and the World", topicText: "India and the nuclear question: changing perceptions and policy", pyqFrequency: 0 },
  {
    id: "psir-iw9",
    subjectId: "political-science-optional",
    paper: 2,
    section: "India and the World",
    topicText: "Recent developments in India's foreign policy: Look East and Act East policies, vision of a new world order, India's role in international organisations (WTO, SAARC, BRICS, ASEAN, G-20)",
    pyqFrequency: 0,
  },
];
