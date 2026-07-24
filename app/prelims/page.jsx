import McqSession from "../../components/McqSession.jsx";

export default function PrelimsPage() {
  return (
    <>
      <h1>Prelims Quiz Arcade</h1>
      <p className="lede">
        Timed rounds of 10 MCQs, drawn from your unlocked GS and optional subjects — the same syllabus content as
        your Mains prep, tested in the objective Prelims format. Answer within 20 seconds to keep your combo streak
        alive for a score multiplier. Graded instantly, tracked separately from your descriptive mastery score.
        CSAT isn't covered here — it's a reasoning/comprehension test, not syllabus-content-based.
      </p>
      <McqSession />
    </>
  );
}
