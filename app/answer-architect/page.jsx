import AnswerArchitect from "../../components/AnswerArchitect.jsx";

export default function AnswerArchitectPage() {
  return (
    <>
      <h1>Answer Architect</h1>
      <p className="lede">
        Build a mains answer by feel, not by typing — swipe to keep the points that belong and discard the
        distractors. No AI grading here; it's scored instantly against a real model answer.
      </p>
      <AnswerArchitect />
    </>
  );
}
