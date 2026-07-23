"use client";

import { useSearchParams } from "next/navigation";
import MockTestFlow from "../../components/MockTestFlow.jsx";

export default function MockTestsPage() {
  const searchParams = useSearchParams();
  const viewTestId = searchParams.get("view");

  return (
    <>
      <h1>Mock tests</h1>
      <p className="lede">
        A timed, multi-question paper — real PYQs where your subject has enough of them, AI-generated to fill the
        rest. No feedback until you submit the whole thing, same as the real exam.
      </p>
      <MockTestFlow viewTestId={viewTestId} />
    </>
  );
}
