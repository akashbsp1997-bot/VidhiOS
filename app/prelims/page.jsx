import McqSession from "../../components/McqSession.jsx";

export default function PrelimsPage() {
  return (
    <>
      <h1>Prelims MCQ practice</h1>
      <p className="lede">
        One MCQ at a time, drawn from your unlocked GS and optional subjects — the same syllabus content as your
        Mains prep, tested in the objective Prelims format. Graded instantly, tracked separately from your
        descriptive mastery score. CSAT isn't covered here — it's a reasoning/comprehension test, not
        syllabus-content-based.
      </p>
      <McqSession />
    </>
  );
}
