"use client";

import { useSearchParams } from "next/navigation";
import InterviewPrep from "../../components/InterviewPrep.jsx";

export default function InterviewPage() {
  const searchParams = useSearchParams();
  const viewSessionId = searchParams.get("view");

  return (
    <>
      <h1>Interview prep</h1>
      <p className="lede">
        A mock Personality Test question set grounded in your own background — practice speaking through answers
        out loud. Not AI-graded: a real interview is judged on delivery and demeanor, not just content, so this is
        a question bank to rehearse against, not a scored test.
      </p>
      <InterviewPrep viewSessionId={viewSessionId} />
    </>
  );
}
