import PracticeSession from "../../../components/PracticeSession.jsx";

// Written for Next.js 15+, where route `params` is a Promise. If your
// Next.js version predates that, change this back to a plain (non-async)
// function reading `params.subtopicId` directly.
export default async function SubtopicPracticePage({ params }) {
  const { subtopicId } = await params;
  return <PracticeSession forcedSubtopicId={subtopicId} subtopicLabel={`Drilling ${subtopicId}`} />;
}
