// db/seed/syllabus.js
// The 81-topic syllabus taxonomy, reused from VidhiOS (already verified: 31
// topics Paper I / 50 topics Paper II, matching the real Drishti IAS Law
// syllabus). pyqFrequency is precomputed from the 168 real PYQs below so the
// adaptive engine and dashboard don't need to recompute it on every request.
export const syllabusSeed = [
  {
    "id": "CA2",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Fundamental Rights — PIL, Legal Aid, Legal Services Authority",
    "pyqFrequency": 7
  },
  {
    "id": "CA7",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Centre, States and Local Bodies: legislative distribution, eminent domain",
    "pyqFrequency": 7
  },
  {
    "id": "CA4",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Constitutional position of the President; relation with Council of Ministers",
    "pyqFrequency": 5
  },
  {
    "id": "IL4",
    "paper": 1,
    "section": "International Law",
    "topicText": "Law of the Sea: territorial sea, contiguous zone, EEZ, continental shelf, high seas",
    "pyqFrequency": 5
  },
  {
    "id": "CA9",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Services under Union & States: recruitment, tribunals, UPSC/SPSC, Election Commission",
    "pyqFrequency": 4
  },
  {
    "id": "IL3",
    "paper": 1,
    "section": "International Law",
    "topicText": "State Recognition and State Succession",
    "pyqFrequency": 4
  },
  {
    "id": "IL5",
    "paper": 1,
    "section": "International Law",
    "topicText": "Individuals: nationality, statelessness, human rights enforcement",
    "pyqFrequency": 4
  },
  {
    "id": "IL8",
    "paper": 1,
    "section": "International Law",
    "topicText": "United Nations: organs, powers, functions, reform",
    "pyqFrequency": 4
  },
  {
    "id": "IL14",
    "paper": 1,
    "section": "International Law",
    "topicText": "New International Economic Order: WTO, TRIPS, GATT, IMF, World Bank",
    "pyqFrequency": 4
  },
  {
    "id": "CR10",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Offences against the human body",
    "pyqFrequency": 4
  },
  {
    "id": "CR12",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Offences against women",
    "pyqFrequency": 4
  },
  {
    "id": "CD1",
    "paper": 2,
    "section": "Contemporary Legal Developments",
    "topicText": "Public Interest Litigation",
    "pyqFrequency": 4
  },
  {
    "id": "CA6",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Supreme Court and High Courts: appointments, transfer, powers, jurisdiction",
    "pyqFrequency": 3
  },
  {
    "id": "CA15",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Judicial review of administrative action",
    "pyqFrequency": 3
  },
  {
    "id": "IL7",
    "paper": 1,
    "section": "International Law",
    "topicText": "Treaties: formation, application, termination, reservation",
    "pyqFrequency": 3
  },
  {
    "id": "IL10",
    "paper": 1,
    "section": "International Law",
    "topicText": "Lawful recourse to force: aggression, self-defence, intervention",
    "pyqFrequency": 3
  },
  {
    "id": "IL13",
    "paper": 1,
    "section": "International Law",
    "topicText": "International terrorism, state-sponsored terrorism, ICC",
    "pyqFrequency": 3
  },
  {
    "id": "CR4",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "General exceptions",
    "pyqFrequency": 3
  },
  {
    "id": "CR11",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Offences against property",
    "pyqFrequency": 3
  },
  {
    "id": "CR14",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Prevention of Corruption Act, 1988",
    "pyqFrequency": 3
  },
  {
    "id": "TO3",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Vicarious liability, including State liability",
    "pyqFrequency": 3
  },
  {
    "id": "TO9",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Nuisance",
    "pyqFrequency": 3
  },
  {
    "id": "TO13",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Consumer Protection Act (1986 / 2019)",
    "pyqFrequency": 3
  },
  {
    "id": "CN3",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Void, voidable, illegal and unenforceable agreements",
    "pyqFrequency": 3
  },
  {
    "id": "CN9",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Sale of goods and hire purchase",
    "pyqFrequency": 3
  },
  {
    "id": "CN10",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Formation and dissolution of partnership / LLP",
    "pyqFrequency": 3
  },
  {
    "id": "CN12",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Arbitration and Conciliation Act, 1996",
    "pyqFrequency": 3
  },
  {
    "id": "CD2",
    "paper": 2,
    "section": "Contemporary Legal Developments",
    "topicText": "Intellectual Property Rights",
    "pyqFrequency": 3
  },
  {
    "id": "CD3",
    "paper": 2,
    "section": "Contemporary Legal Developments",
    "topicText": "IT Law including Cyber Law",
    "pyqFrequency": 3
  },
  {
    "id": "CD7",
    "paper": 2,
    "section": "Contemporary Legal Developments",
    "topicText": "Right to Information Act",
    "pyqFrequency": 3
  },
  {
    "id": "CA1",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Constitution and Constitutionalism: distinctive features of the Constitution",
    "pyqFrequency": 2
  },
  {
    "id": "CA3",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Relationship between Fundamental Rights, Directive Principles and Fundamental Duties",
    "pyqFrequency": 2
  },
  {
    "id": "CA5",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Governor and his powers",
    "pyqFrequency": 2
  },
  {
    "id": "CA8",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Legislative powers, privileges and immunities",
    "pyqFrequency": 2
  },
  {
    "id": "CA10",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Emergency provisions",
    "pyqFrequency": 2
  },
  {
    "id": "CA11",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Amendment of the Constitution",
    "pyqFrequency": 2
  },
  {
    "id": "CA16",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Ombudsman: Lokayukta, Lokpal",
    "pyqFrequency": 2
  },
  {
    "id": "IL1",
    "paper": 1,
    "section": "International Law",
    "topicText": "Nature and definition of International Law",
    "pyqFrequency": 2
  },
  {
    "id": "IL2",
    "paper": 1,
    "section": "International Law",
    "topicText": "Relationship between International Law and Municipal Law",
    "pyqFrequency": 2
  },
  {
    "id": "IL6",
    "paper": 1,
    "section": "International Law",
    "topicText": "Territorial jurisdiction, extradition and asylum",
    "pyqFrequency": 2
  },
  {
    "id": "IL9",
    "paper": 1,
    "section": "International Law",
    "topicText": "Peaceful settlement of disputes",
    "pyqFrequency": 2
  },
  {
    "id": "IL12",
    "paper": 1,
    "section": "International Law",
    "topicText": "Legality of nuclear weapons; CTBT, NPT",
    "pyqFrequency": 2
  },
  {
    "id": "CR1",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "General principles: mens rea, actus reus, statutory offences",
    "pyqFrequency": 2
  },
  {
    "id": "CR6",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Abetment",
    "pyqFrequency": 2
  },
  {
    "id": "CR15",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Protection of Civil Rights Act, 1955 and after",
    "pyqFrequency": 2
  },
  {
    "id": "TO7",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Negligence",
    "pyqFrequency": 2
  },
  {
    "id": "TO12",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Malicious prosecution",
    "pyqFrequency": 2
  },
  {
    "id": "CN1",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Nature/formation of contract; e-contracts",
    "pyqFrequency": 2
  },
  {
    "id": "CN2",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Factors vitiating free consent",
    "pyqFrequency": 2
  },
  {
    "id": "CN5",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Quasi-contracts",
    "pyqFrequency": 2
  },
  {
    "id": "CN7",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Indemnity, guarantee and insurance",
    "pyqFrequency": 2
  },
  {
    "id": "CN8",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Contract of agency",
    "pyqFrequency": 2
  },
  {
    "id": "CD6",
    "paper": 2,
    "section": "Contemporary Legal Developments",
    "topicText": "Environmental law statutes",
    "pyqFrequency": 2
  },
  {
    "id": "CA12",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Principles of Natural Justice",
    "pyqFrequency": 1
  },
  {
    "id": "CA13",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Delegated legislation and its constitutionality",
    "pyqFrequency": 1
  },
  {
    "id": "CA14",
    "paper": 1,
    "section": "Constitutional and Administrative Law",
    "topicText": "Separation of powers and constitutional governance",
    "pyqFrequency": 1
  },
  {
    "id": "IL11",
    "paper": 1,
    "section": "International Law",
    "topicText": "International humanitarian law",
    "pyqFrequency": 1
  },
  {
    "id": "IL15",
    "paper": 1,
    "section": "International Law",
    "topicText": "Protection of the human environment",
    "pyqFrequency": 1
  },
  {
    "id": "CR2",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Kinds of punishment; abolition of capital punishment debate",
    "pyqFrequency": 1
  },
  {
    "id": "CR5",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Joint and constructive liability",
    "pyqFrequency": 1
  },
  {
    "id": "CR7",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Criminal conspiracy",
    "pyqFrequency": 1
  },
  {
    "id": "CR16",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Plea bargaining",
    "pyqFrequency": 1
  },
  {
    "id": "TO1",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Nature and definition of torts",
    "pyqFrequency": 1
  },
  {
    "id": "TO2",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Fault, strict and absolute liability",
    "pyqFrequency": 1
  },
  {
    "id": "TO6",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Remedies",
    "pyqFrequency": 1
  },
  {
    "id": "TO8",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Defamation (tort)",
    "pyqFrequency": 1
  },
  {
    "id": "TO11",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "False imprisonment",
    "pyqFrequency": 1
  },
  {
    "id": "CN4",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Performance and discharge of contracts",
    "pyqFrequency": 1
  },
  {
    "id": "CN6",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Consequences of breach of contract",
    "pyqFrequency": 1
  },
  {
    "id": "CN11",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Negotiable Instruments Act, 1881",
    "pyqFrequency": 1
  },
  {
    "id": "CN13",
    "paper": 2,
    "section": "Law of Contracts and Mercantile Law",
    "topicText": "Standard form contracts",
    "pyqFrequency": 1
  },
  {
    "id": "CD4",
    "paper": 2,
    "section": "Contemporary Legal Developments",
    "topicText": "Competition Law",
    "pyqFrequency": 1
  },
  {
    "id": "CD5",
    "paper": 2,
    "section": "Contemporary Legal Developments",
    "topicText": "Alternate Dispute Resolution",
    "pyqFrequency": 1
  },
  {
    "id": "CD8",
    "paper": 2,
    "section": "Contemporary Legal Developments",
    "topicText": "Trial by media",
    "pyqFrequency": 1
  },
  {
    "id": "CR3",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Preparation and criminal attempt",
    "pyqFrequency": 0
  },
  {
    "id": "CR8",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Offences against the State",
    "pyqFrequency": 0
  },
  {
    "id": "CR9",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Offences against public tranquility",
    "pyqFrequency": 0
  },
  {
    "id": "CR13",
    "paper": 2,
    "section": "Law of Crimes",
    "topicText": "Defamation (criminal)",
    "pyqFrequency": 0
  },
  {
    "id": "TO4",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "General defences",
    "pyqFrequency": 0
  },
  {
    "id": "TO5",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Joint tortfeasors",
    "pyqFrequency": 0
  },
  {
    "id": "TO10",
    "paper": 2,
    "section": "Law of Torts",
    "topicText": "Conspiracy (tort)",
    "pyqFrequency": 0
  }
];
