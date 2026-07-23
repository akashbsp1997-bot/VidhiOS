// db/seed/political-science-pyqs.js
//
// 84 real UPSC CSE Political Science and International Relations (PSIR)
// Optional Mains PYQs: 2024 Paper I, 2023 Paper I, and 2021 Paper II (28
// questions each, all 8 questions x 5/3 sub-parts per paper). Fetched from
// upsc.gov.in where reachable; upsc.gov.in itself returns a hard connection
// reset from this app's infrastructure, so all three were actually pulled
// from web.archive.org snapshots of the exact same official upsc.gov.in PDF
// URLs (booklet codes/cover pages confirmed against the extracted text --
// the "Paper II" PDF used for 2021 turned out, on inspection of its own
// cover page, to actually be the 2021 paper despite an undated filename,
// so the year below is taken from the paper's own printed cover text, not
// the URL). All three PDFs had real text layers (not scanned images), so
// this is direct text extraction, not OCR -- the highest-confidence PYQ
// source in this codebase alongside 2015's GS2 paper. No question was
// reconstructed from memory or taken from a third-party compilation site.
// This supersedes the earlier decision (see the old header comment in
// political-science-syllabus.js, now corrected) to withhold PSIR PYQs for
// lack of verbatim text -- that gap is closed as of this file.
//
// Every one of PSIR's 8 questions per paper is compound: Q1 and Q5 are
// compulsory, each with 5 lettered sub-parts (a-e) at 10 marks/~150 words;
// Q2-Q4 and Q6-Q8 each have 3 lettered sub-parts at 20/15/15 marks. `slot`
// is the real question number (1-8) and `sub` is the real lettered
// sub-part -- unlike gs2-pyqs.js (where `sub` is always "a"), PSIR's
// sub-parts are modeled as individual PYQ rows the same way Law Optional's
// occasional compound questions are, since each sub-part is independently
// answerable and separately markable. `sec` "A" reflects Q1-Q4, "B"
// reflects Q5-Q8, matching the real paper's own Section A/B split. `paper`
// is 1 for Political Theory & Indian Government/Politics, 2 for
// Comparative Politics/IR/India and the World, matching psir-pt*/psir-igp*
// (paper 1) and psir-cp*/psir-ir*/psir-iw* (paper 2) in
// political-science-syllabus.js.
//
// `topics` is single-tagged per sub-question against the 41 psir-* subtopics,
// matched to the closest official syllabus line item -- several sub-parts
// plausibly touch more than one topic (e.g. Q1(a) in 2021 Paper II could
// fit either comparative-politics approaches or IR theory), but single-
// tagging keeps this initial dataset tractable, consistent with gs2-pyqs.js.
export const politicalSciencePyqsSeed = [
  // ---------- 2024 Paper I (booklet PHKM-U-POL) ----------
  { id: "Y24-PSIR-P1-Q1a", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 1, sec: "A", sub: "a", marks: 10, topics: ["psir-pt1"], questionText: "Behavioural approach to Political Science." },
  { id: "Y24-PSIR-P1-Q1b", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 1, sec: "A", sub: "b", marks: 10, topics: ["psir-pt2"], questionText: "Pluralist theory of State." },
  { id: "Y24-PSIR-P1-Q1c", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 1, sec: "A", sub: "c", marks: 10, topics: ["psir-pt10"], questionText: "Locke's views on Revolution." },
  { id: "Y24-PSIR-P1-Q1d", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 1, sec: "A", sub: "d", marks: 10, topics: ["psir-pt8"], questionText: "Decline of Liberalism." },
  { id: "Y24-PSIR-P1-Q1e", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 1, sec: "A", sub: "e", marks: 10, topics: ["psir-pt7"], questionText: "Linkage between Power and Hegemony." },
  { id: "Y24-PSIR-P1-Q2a", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 2, sec: "A", sub: "a", marks: 20, topics: ["psir-pt1"], questionText: "Elucidate the various meanings inherent in the term 'political' with appropriate illustrations." },
  { id: "Y24-PSIR-P1-Q2b", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 2, sec: "A", sub: "b", marks: 15, topics: ["psir-pt8"], questionText: "Marxism is a political theory of action demanding strict compliance with its core principles. Comment." },
  { id: "Y24-PSIR-P1-Q2c", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 2, sec: "A", sub: "c", marks: 15, topics: ["psir-pt4"], questionText: "The nature of relationship between equality of democratic citizenship and liberty of citizens is influenced by economic equality. Comment." },
  { id: "Y24-PSIR-P1-Q3a", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 3, sec: "A", sub: "a", marks: 20, topics: ["psir-pt5"], questionText: "The debate on human rights is caught between the limitations of both universalism and cultural relativism. Comment." },
  { id: "Y24-PSIR-P1-Q3b", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 3, sec: "A", sub: "b", marks: 15, topics: ["psir-pt6"], questionText: "Deliberative democracy seeks to promote democratic decision making about public issues among the citizens. Discuss." },
  { id: "Y24-PSIR-P1-Q3c", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 3, sec: "A", sub: "c", marks: 15, topics: ["psir-pt9"], questionText: "Dharmashastra presents a duty-centric worldview for individuals and communities. Comment." },
  { id: "Y24-PSIR-P1-Q4a", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 4, sec: "A", sub: "a", marks: 20, topics: ["psir-pt7"], questionText: "Legitimacy adds positive value to political authority and obligation. Discuss." },
  { id: "Y24-PSIR-P1-Q4b", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 4, sec: "A", sub: "b", marks: 15, topics: ["psir-pt10"], questionText: "Critically examine Plato's theory of Forms." },
  { id: "Y24-PSIR-P1-Q4c", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 4, sec: "A", sub: "c", marks: 15, topics: ["psir-pt9"], questionText: "Manabendra Nath Roy's political thought highlighted the humanistic aspects of Marxism. Discuss." },
  { id: "Y24-PSIR-P1-Q5a", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 5, sec: "B", sub: "a", marks: 10, topics: ["psir-igp3"], questionText: "Constitutional morality in the Indian Constitution." },
  { id: "Y24-PSIR-P1-Q5b", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 5, sec: "B", sub: "b", marks: 10, topics: ["psir-igp2"], questionText: "Objective Resolution of the Constituent Assembly." },
  { id: "Y24-PSIR-P1-Q5c", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 5, sec: "B", sub: "c", marks: 10, topics: ["psir-igp3"], questionText: "Legal remedies in Part III of the Constitution of India." },
  { id: "Y24-PSIR-P1-Q5d", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 5, sec: "B", sub: "d", marks: 10, topics: ["psir-igp5"], questionText: "Relevance of the Legislative Council." },
  { id: "Y24-PSIR-P1-Q5e", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 5, sec: "B", sub: "e", marks: 10, topics: ["psir-igp12"], questionText: "Women's role in anti-arrack movement." },
  { id: "Y24-PSIR-P1-Q6a", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 6, sec: "B", sub: "a", marks: 20, topics: ["psir-igp3"], questionText: "How far do you agree that the Directive Principles of State Policy are more fundamental than the Fundamental Rights in meeting socio-economic justice as mentioned in the Preamble of the Constitution?" },
  { id: "Y24-PSIR-P1-Q6b", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 6, sec: "B", sub: "b", marks: 15, topics: ["psir-igp7"], questionText: "Explain the structure and functions of the National Commission for Women." },
  { id: "Y24-PSIR-P1-Q6c", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 6, sec: "B", sub: "c", marks: 15, topics: ["psir-igp9"], questionText: "The legacy of the Planning Commission still has a bearing on India's development policies. Discuss." },
  { id: "Y24-PSIR-P1-Q7a", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 7, sec: "B", sub: "a", marks: 20, topics: ["psir-igp10"], questionText: "Discuss the contribution of the Dalit struggle to establish egalitarianism in Indian society during freedom movement." },
  { id: "Y24-PSIR-P1-Q7b", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 7, sec: "B", sub: "b", marks: 15, topics: ["psir-igp9"], questionText: "The blueprint of Gram Swaraj is the key to understand the Gandhian perspective on planning. Discuss." },
  { id: "Y24-PSIR-P1-Q7c", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 7, sec: "B", sub: "c", marks: 15, topics: ["psir-igp11"], questionText: "Critically assess the role of pressure groups in the decision-making process of the government." },
  { id: "Y24-PSIR-P1-Q8a", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 8, sec: "B", sub: "a", marks: 20, topics: ["psir-igp12"], questionText: "Discuss the role of environmental movements in shaping the environmental governance in India." },
  { id: "Y24-PSIR-P1-Q8b", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 8, sec: "B", sub: "b", marks: 15, topics: ["psir-igp10"], questionText: "'Relative deprivation is a major source of ethnic conflict.' Elaborate the statement with relevant examples." },
  { id: "Y24-PSIR-P1-Q8c", subjectId: "political-science-optional", paper: 1, year: 2024, slot: 8, sec: "B", sub: "c", marks: 15, topics: ["psir-igp6"], questionText: "Gram Sabha in the Panchayati Raj system is a forum which gives expression to the collective wisdom, aspirations and the will of the people. Comment." },

  // ---------- 2023 Paper I (booklet SKYC-U-POLI) ----------
  { id: "Y23-PSIR-P1-Q1a", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 1, sec: "A", sub: "a", marks: 10, topics: ["psir-pt1"], questionText: "Normative approach in Political Science." },
  { id: "Y23-PSIR-P1-Q1b", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 1, sec: "A", sub: "b", marks: 10, topics: ["psir-pt5"], questionText: "Multicultural perspective on rights." },
  { id: "Y23-PSIR-P1-Q1c", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 1, sec: "A", sub: "c", marks: 10, topics: ["psir-pt10"], questionText: "State of Nature as State of War (Hobbes)." },
  { id: "Y23-PSIR-P1-Q1d", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 1, sec: "A", sub: "d", marks: 10, topics: ["psir-pt7"], questionText: "Foucault's concept of power." },
  { id: "Y23-PSIR-P1-Q1e", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 1, sec: "A", sub: "e", marks: 10, topics: ["psir-pt1"], questionText: "Decline of political theory." },
  { id: "Y23-PSIR-P1-Q2a", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 2, sec: "A", sub: "a", marks: 20, topics: ["psir-pt6"], questionText: "Success of contemporary democracies lies in the State limiting its own power. Explain." },
  { id: "Y23-PSIR-P1-Q2b", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 2, sec: "A", sub: "b", marks: 15, topics: ["psir-pt3"], questionText: "Rawls' idea of the 'liberal self' is too individualistic. Explain, in this context, the communitarian critique of Rawls' theory of justice." },
  { id: "Y23-PSIR-P1-Q2c", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 2, sec: "A", sub: "c", marks: 15, topics: ["psir-pt1"], questionText: "'Credo of Relevance' in post-behaviouralism advocates the importance of action science. Analyze." },
  { id: "Y23-PSIR-P1-Q3a", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 3, sec: "A", sub: "a", marks: 20, topics: ["psir-pt8"], questionText: "Fascism displays an ambivalent stance towards parliamentary democracy. Explain." },
  { id: "Y23-PSIR-P1-Q3b", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 3, sec: "A", sub: "b", marks: 15, topics: ["psir-pt4"], questionText: "Affirmative Action Policies draw as much strong support as strong criticism. Analyze this statement in the context of equality." },
  { id: "Y23-PSIR-P1-Q3c", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 3, sec: "A", sub: "c", marks: 15, topics: ["psir-pt2"], questionText: "Eurocentrism is both the target and the motive force of the post-colonial political theory. Discuss." },
  { id: "Y23-PSIR-P1-Q4a", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 4, sec: "A", sub: "a", marks: 20, topics: ["psir-pt9"], questionText: "Buddhist thought on Dhamma facilitates the emancipation of political action. Explain." },
  { id: "Y23-PSIR-P1-Q4b", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 4, sec: "A", sub: "b", marks: 15, topics: ["psir-pt10"], questionText: "'The legal subordination of one sex to another is wrong in itself, and now one of the chief hindrances to human development.' (J. S. Mill). Comment." },
  { id: "Y23-PSIR-P1-Q4c", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 4, sec: "A", sub: "c", marks: 15, topics: ["psir-pt9"], questionText: "Sri Aurobindo's idea of Swaraj has deep significance in the Indian social, political and cultural history. Analyze." },
  { id: "Y23-PSIR-P1-Q5a", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 5, sec: "B", sub: "a", marks: 10, topics: ["psir-igp2"], questionText: "Imprint of the British Constitution on the Indian Constitution." },
  { id: "Y23-PSIR-P1-Q5b", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 5, sec: "B", sub: "b", marks: 10, topics: ["psir-igp12"], questionText: "Environmentalism of the poor." },
  { id: "Y23-PSIR-P1-Q5c", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 5, sec: "B", sub: "c", marks: 10, topics: ["psir-igp6"], questionText: "Functions of District Planning Committee." },
  { id: "Y23-PSIR-P1-Q5d", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 5, sec: "B", sub: "d", marks: 10, topics: ["psir-igp1"], questionText: "Satyagraha and Indian Nationalism." },
  { id: "Y23-PSIR-P1-Q5e", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 5, sec: "B", sub: "e", marks: 10, topics: ["psir-igp7"], questionText: "National Commission for Minorities." },
  { id: "Y23-PSIR-P1-Q6a", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 6, sec: "B", sub: "a", marks: 20, topics: ["psir-igp6"], questionText: "Discuss the major provisions of the 74th Constitutional Amendment Act. Do you think that the Act remains an 'unfulfilled dream'? Argue your case." },
  { id: "Y23-PSIR-P1-Q6b", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 6, sec: "B", sub: "b", marks: 15, topics: ["psir-igp9"], questionText: "How does NITI Aayog as a 'policy think tank with shared vision' visualize the reorganization of planning in India? Justify your answer." },
  { id: "Y23-PSIR-P1-Q6c", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 6, sec: "B", sub: "c", marks: 15, topics: ["psir-igp3"], questionText: "The Constitution of India is the 'cornerstone of a nation'. (Granville Austin). Analyze." },
  { id: "Y23-PSIR-P1-Q7a", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 7, sec: "B", sub: "a", marks: 20, topics: ["psir-igp8"], questionText: "Does the actual working of Indian federalism conform to the centralizing tendencies in Indian polity? Give reasons for your answer." },
  { id: "Y23-PSIR-P1-Q7b", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 7, sec: "B", sub: "b", marks: 15, topics: ["psir-igp3"], questionText: "The main goal of the Fundamental Duties in the Indian Constitution is to generate civic responsibility among the citizens. Explain." },
  { id: "Y23-PSIR-P1-Q7c", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 7, sec: "B", sub: "c", marks: 15, topics: ["psir-igp10"], questionText: "Dr. Ambedkar's clarion call, 'Educate, Agitate and Organize', strategizes the Dalit movement towards achieving civil liberty. Discuss." },
  { id: "Y23-PSIR-P1-Q8a", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 8, sec: "B", sub: "a", marks: 20, topics: ["psir-igp10"], questionText: "The rise of caste politics is to be attributed to both regional aspirations and electoral manifestations. Comment." },
  { id: "Y23-PSIR-P1-Q8b", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 8, sec: "B", sub: "b", marks: 15, topics: ["psir-igp11"], questionText: "The decade 1989-1999 has created an epochal shift in the Indian party system at the national level. Identify the major national trends in the party system during this era." },
  { id: "Y23-PSIR-P1-Q8c", subjectId: "political-science-optional", paper: 1, year: 2023, slot: 8, sec: "B", sub: "c", marks: 15, topics: ["psir-igp4"], questionText: "Do you agree that over the years the Supreme Court has become a forum for policy evolution? Justify your answer." },

  // ---------- 2021 Paper II (booklet HXS-B-POLI) ----------
  { id: "Y21-PSIR-P2-Q1a", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 1, sec: "A", sub: "a", marks: 10, topics: ["psir-cp1"], questionText: "Discuss the political economy approach to the comparative analysis of politics." },
  { id: "Y21-PSIR-P2-Q1b", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 1, sec: "A", sub: "b", marks: 10, topics: ["psir-cp3"], questionText: "'Political parties and pressure groups are sine qua non of democracy.' Comment." },
  { id: "Y21-PSIR-P2-Q1c", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 1, sec: "A", sub: "c", marks: 10, topics: ["psir-ir1"], questionText: "'Marxist approach to the study of international relations has lost its relevance in the post-cold war era.' Comment." },
  { id: "Y21-PSIR-P2-Q1d", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 1, sec: "A", sub: "d", marks: 10, topics: ["psir-ir4"], questionText: "What measures have been undertaken by the United Nations for its reforms?" },
  { id: "Y21-PSIR-P2-Q1e", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 1, sec: "A", sub: "e", marks: 10, topics: ["psir-ir6"], questionText: "Discuss the five proposals made by India in the recent COP-26 conference held in Glasgow." },
  { id: "Y21-PSIR-P2-Q2a", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 2, sec: "A", sub: "a", marks: 20, topics: ["psir-cp2"], questionText: "'The post-colonial state was thought of as an entity that stood outside and above society as an autonomous agency.' Explain." },
  { id: "Y21-PSIR-P2-Q2b", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 2, sec: "A", sub: "b", marks: 15, topics: ["psir-ir1"], questionText: "Discuss the emergence of neo-realism and its basic tenets." },
  { id: "Y21-PSIR-P2-Q2c", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 2, sec: "A", sub: "c", marks: 15, topics: ["psir-ir2"], questionText: "What is 'complex interdependence'? Discuss the role of transnational actors in the international system." },
  { id: "Y21-PSIR-P2-Q3a", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 3, sec: "A", sub: "a", marks: 20, topics: ["psir-cp3"], questionText: "Explain the impact of electoral systems and cleavages in shaping party systems with reference to developing countries." },
  { id: "Y21-PSIR-P2-Q3b", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 3, sec: "A", sub: "b", marks: 15, topics: ["psir-cp4"], questionText: "What is globalisation? Why is there an intense debate about globalisation and its consequences?" },
  { id: "Y21-PSIR-P2-Q3c", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 3, sec: "A", sub: "c", marks: 15, topics: ["psir-ir3"], questionText: "Critically examine the decline of the United States of America as a hegemon and its implications for the changing international political order." },
  { id: "Y21-PSIR-P2-Q4a", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 4, sec: "A", sub: "a", marks: 20, topics: ["psir-cp1"], questionText: "The modernization thesis asserts that affluence breeds stable democracy. How do you explain the success of India being the world's largest democracy as an exceptional case?" },
  { id: "Y21-PSIR-P2-Q4b", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 4, sec: "A", sub: "b", marks: 15, topics: ["psir-ir5"], questionText: "Explain the success of ASEAN as a regional organisation." },
  { id: "Y21-PSIR-P2-Q4c", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 4, sec: "A", sub: "c", marks: 15, topics: ["psir-iw6"], questionText: "Explain India's relations with the European Union in the context of Brexit." },
  { id: "Y21-PSIR-P2-Q5a", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 5, sec: "B", sub: "a", marks: 10, topics: ["psir-iw9"], questionText: "Discuss the strategic implications of India's 'Look East Policy' transforming into 'Act East Policy'." },
  { id: "Y21-PSIR-P2-Q5b", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 5, sec: "B", sub: "b", marks: 10, topics: ["psir-iw1"], questionText: "Explain the philosophical foundations of India's foreign policy." },
  { id: "Y21-PSIR-P2-Q5c", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 5, sec: "B", sub: "c", marks: 10, topics: ["psir-iw9"], questionText: "Explain India's position on the waiver of intellectual property rights on COVID-19 vaccines in WTO." },
  { id: "Y21-PSIR-P2-Q5d", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 5, sec: "B", sub: "d", marks: 10, topics: ["psir-iw6"], questionText: "Write about the growing significance of QUAD." },
  { id: "Y21-PSIR-P2-Q5e", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 5, sec: "B", sub: "e", marks: 10, topics: ["psir-iw4"], questionText: "How does the recent takeover of Afghanistan by Taliban impact India's strategic interests?" },
  { id: "Y21-PSIR-P2-Q6a", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 6, sec: "B", sub: "a", marks: 20, topics: ["psir-iw2"], questionText: "'Non-alignment was little more than a rational strategy on the part of a materially weak India to maximise its interests with a bipolar distribution of global power.' Comment." },
  { id: "Y21-PSIR-P2-Q6b", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 6, sec: "B", sub: "b", marks: 15, topics: ["psir-iw3"], questionText: "Examine the Geo-strategic points of contention in the bilateral relationship between India and China." },
  { id: "Y21-PSIR-P2-Q6c", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 6, sec: "B", sub: "c", marks: 15, topics: ["psir-iw4"], questionText: "Write a brief analysis of the ethnic conflicts and cross-border migrations along India-Myanmar and India-Bangladesh borders." },
  { id: "Y21-PSIR-P2-Q7a", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 7, sec: "B", sub: "a", marks: 20, topics: ["psir-iw4"], questionText: "Why is South Asia considered as the world's politically and economically least integrated region? Explain." },
  { id: "Y21-PSIR-P2-Q7b", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 7, sec: "B", sub: "b", marks: 15, topics: ["psir-iw1"], questionText: "How do the constituent states influence the foreign policy making process in India?" },
  { id: "Y21-PSIR-P2-Q7c", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 7, sec: "B", sub: "c", marks: 15, topics: ["psir-iw8"], questionText: "Examine the evolution of India's role in the global nuclear order." },
  { id: "Y21-PSIR-P2-Q8a", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 8, sec: "B", sub: "a", marks: 20, topics: ["psir-iw3"], questionText: "'Relations between India and Russia are rooted in history, mutual trust and mutually beneficial cooperation.' Discuss." },
  { id: "Y21-PSIR-P2-Q8b", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 8, sec: "B", sub: "b", marks: 15, topics: ["psir-ir6"], questionText: "Discuss the 'Sustainable Development Goals' as set by the United Nations." },
  { id: "Y21-PSIR-P2-Q8c", subjectId: "political-science-optional", paper: 2, year: 2021, slot: 8, sec: "B", sub: "c", marks: 15, topics: ["psir-iw5"], questionText: "Identify the drivers of India's new interest in Africa." },
];
