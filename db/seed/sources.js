// db/seed/sources.js
//
// A deliberately small, HAND-VERIFIED starting batch, not a guessed/bulk
// list. Every URL below was actually looked up and confirmed live while
// building this repo (see docs/ARCHITECTURE.md for the "why not autonomous
// crawling" reasoning). It covers most of the highest-PYQ-frequency
// subtopics; the other ~65 subtopics intentionally start with zero sources
// — add rows here (or through a future "add source" admin UI) following the
// same pattern, then hit "Fetch now" on the subtopic's /sources page.
//
// One important, current fact baked into this batch: since 1 July 2024 the
// Indian Penal Code has been REPLACED by the Bharatiya Nyaya Sanhita (BNS),
// 2023 — the Law of Crimes sources below point at BNS as the current law,
// not the historical IPC. 2023-24 PYQs in this app were written under IPC
// section numbers; when the AI grades or generates crimes questions, keep
// in mind an answer that only cites old IPC sections is citing repealed law.

export const sourcesSeed = [
  // --- Constitution of India (covers several Paper I Constitutional Law topics) ---
  {
    subtopicId: "CA1",
    title: "Constitution of India — India Code (official)",
    url: "https://www.indiacode.nic.in/handle/123456789/15240",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CA1",
    title: "Constitution of India — full text PDF (India Code)",
    url: "https://www.indiacode.nic.in/bitstream/123456789/19632/1/the_constitution_of_india.pdf",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CA2",
    title: "Constitution of India, Part III (Fundamental Rights) — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/15240",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CA2",
    title: "Legal Services Authorities Act, 1987 — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/1925?locale=en",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CA2",
    title: "National Legal Services Authority (NALSA) — official site",
    url: "https://nalsa.gov.in/the-legal-services-authorities-act-1987/",
    sourceType: "other",
    official: true,
  },
  {
    subtopicId: "CA4",
    title: "Constitution of India, Part V (President, Council of Ministers) — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/15240",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CA6",
    title: "Constitution of India, Part V/VI (Supreme Court, High Courts) — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/15240",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CA7",
    title: "Constitution of India, Part XI (Centre-State relations) — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/15240",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CA9",
    title: "Constitution of India, Part XIV (Services under the Union/States) — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/15240",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CA15",
    title: "Constitution of India, Arts. 32/226 (writ jurisdiction) — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/15240",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CD1",
    title: "Legal Services Authorities Act, 1987 — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/1925?locale=en",
    sourceType: "bare_act",
    official: true,
  },

  // --- Bharatiya Nyaya Sanhita, 2023 (current law, replaced the IPC on 1 July 2024) ---
  {
    subtopicId: "CR4",
    title: "Bharatiya Nyaya Sanhita, 2023 — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/20062?locale=en",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CR4",
    title: "Bharatiya Nyaya Sanhita, 2023 — full text PDF (India Code)",
    url: "https://www.indiacode.nic.in/bitstream/123456789/20062/1/a202345.pdf",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CR10",
    title: "Bharatiya Nyaya Sanhita, 2023, Ch. VI (Offences Affecting the Human Body) — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/20062?locale=en",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CR11",
    title: "Bharatiya Nyaya Sanhita, 2023, offences against property — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/20062?locale=en",
    sourceType: "bare_act",
    official: true,
  },
  {
    subtopicId: "CR12",
    title: "Bharatiya Nyaya Sanhita, 2023, Ch. V (Offences Against Woman and Child) — India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/20062?locale=en",
    sourceType: "bare_act",
    official: true,
  },

  // --- International Law (UN primary texts) ---
  {
    subtopicId: "IL4",
    title: "UN Convention on the Law of the Sea (UNCLOS), 1982 — full text (UN)",
    url: "https://www.un.org/Depts/los/convention_agreements/texts/unclos/UNCLOS-TOC.htm",
    sourceType: "treaty",
    official: true,
  },
  {
    subtopicId: "IL8",
    title: "Charter of the United Nations — full text (UN)",
    url: "https://www.un.org/en/about-us/un-charter/full-text",
    sourceType: "treaty",
    official: true,
  },
];
