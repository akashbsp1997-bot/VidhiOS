// db/seed/cases.js
// A small, hand-curated set of well-established landmark cases, reused from
// VidhiOS (already scoped to genuinely canonical, textbook-level cases —
// not an exhaustive case-law database). Used as GROUNDING for case-law
// content generation (lib/ai/generateLesson.js): the AI is given the real
// case name + core point for any case tagged to the subtopic being taught,
// and asked to expand facts/holding/significance around that verified
// anchor rather than free-generating a case from memory alone. Subtopics
// with no entry here get case law from the AI's own knowledge instead,
// with the same 'don't invent citations' discipline used everywhere else
// in this app — still verify before citing in an actual answer.
export const casesSeed = [
  { "topics": ["CA11"], "case": "Kesavananda Bharati v. State of Kerala (1973)", "point": "Basic Structure doctrine — Parliament cannot amend the Constitution's basic features" },
  { "topics": ["CA11"], "case": "I.C. Golaknath v. State of Punjab (1967)", "point": "Parliament could not abridge Fundamental Rights (later modified by Kesavananda)" },
  { "topics": ["CA11", "CA3"], "case": "Minerva Mills v. Union of India (1980)", "point": "Balance between Part III & Part IV is itself part of the basic structure" },
  { "topics": ["CA2"], "case": "Maneka Gandhi v. Union of India (1978)", "point": "Article 21 expanded — 'procedure established by law' must be fair, just and reasonable" },
  { "topics": ["CA2"], "case": "K.S. Puttaswamy v. Union of India (2017)", "point": "Right to privacy read into Article 21" },
  { "topics": ["CA10"], "case": "S.R. Bommai v. Union of India (1994)", "point": "Article 356 President's Rule made subject to judicial review; floor test as proof of majority" },
  { "topics": ["CA9"], "case": "Indra Sawhney v. Union of India (1992)", "point": "Mandal case — reservation ceiling, creamy layer" },
  { "topics": ["CA12"], "case": "A.K. Kraipak v. Union of India (1969)", "point": "Blurred the line between administrative and quasi-judicial functions for natural justice purposes" },
  { "topics": ["CA9", "CA15"], "case": "L. Chandra Kumar v. Union of India (1997)", "point": "HC/SC judicial review over tribunals cannot be excluded" },
  { "topics": ["CA2"], "case": "Vishaka v. State of Rajasthan (1997)", "point": "Guidelines against sexual harassment at workplace, later codified" },
  { "topics": ["TO2"], "case": "Rylands v. Fletcher (1868)", "point": "Origin of strict liability for escape of a dangerous thing" },
  { "topics": ["TO2"], "case": "M.C. Mehta v. Union of India (1987)", "point": "Absolute liability — Oleum Gas Leak case, no exceptions for hazardous industry" },
  { "topics": ["TO7"], "case": "Donoghue v. Stevenson (1932)", "point": "Modern duty-of-care / neighbour principle in negligence" },
  { "topics": ["TO1"], "case": "Ashby v. White (1703)", "point": "Origin of the maxim ubi jus ibi remedium" },
  { "topics": ["CN1"], "case": "Carlill v. Carbolic Smoke Ball Co. (1893)", "point": "Unilateral offer, general offer to the world" },
  { "topics": ["CN1"], "case": "Balfour v. Balfour (1919)", "point": "Domestic/social agreements lack intent to create legal relations" },
  { "topics": ["CN1"], "case": "Lalman Shukla v. Gauri Dutt (1913)", "point": "Acceptance requires knowledge of the offer" },
  { "topics": ["CR10"], "case": "K.M. Nanavati v. State of Maharashtra (1961)", "point": "Grave and sudden provocation — culpable homicide vs murder" },
  { "topics": ["CR2"], "case": "Bachan Singh v. State of Punjab (1980)", "point": "'Rarest of rare' doctrine for death penalty" },
  { "topics": ["CR2"], "case": "Machhi Singh v. State of Punjab (1983)", "point": "Elaborated the rarest-of-rare categories" },
  { "topics": ["CD1"], "case": "S.P. Gupta v. Union of India (1981)", "point": "Judges' Transfer case — liberalised locus standi, birth of Indian PIL" },
  { "topics": ["CD1"], "case": "Bandhua Mukti Morcha v. Union of India (1984)", "point": "Epistolary jurisdiction, PIL for bonded labourers" },
  { "topics": ["CD3"], "case": "Shreya Singhal v. Union of India (2015)", "point": "Struck down IT Act Section 66A as unconstitutional" },
  { "topics": ["CR14"], "case": "Subramanian Swamy v. Manmohan Singh (2012)", "point": "Time limits on sanction for prosecution under PC Act" },
  { "topics": ["CA6"], "case": "Second Judges Case / Advocates-on-Record Assn. v. Union of India (1993)", "point": "Origin of the collegium system for judicial appointments" },
  { "topics": ["IL10"], "case": "Nicaragua v. United States (ICJ, 1986)", "point": "Limits on the right to collective self-defence" },
  { "topics": ["IL4"], "case": "North Sea Continental Shelf Cases (ICJ, 1969)", "point": "Equidistance is not a binding customary rule for shelf delimitation" },
  { "topics": ["CN9"], "case": "Sale of Goods — risk prima facie passes with property (Sec. 26)", "point": "Statutory rule, not a case — cite Section 26, Sale of Goods Act, 1930" },
  { "topics": ["TO3"], "case": "Kasturilal v. State of U.P. (1965)", "point": "Sovereign immunity for acts done in exercise of sovereign power (much criticised, contrast with modern trend)" },
  { "topics": ["CA15"], "case": "State of U.P. v. Mohammad Nooh (1958)", "point": "Certiorari can lie despite an available alternative remedy in cases of breach of natural justice" }
];
