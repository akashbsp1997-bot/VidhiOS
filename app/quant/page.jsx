import QuantPuzzleChain from "../../components/QuantPuzzleChain.jsx";

export default function QuantPage() {
  return (
    <>
      <h1>Quant Puzzle Chain</h1>
      <p className="lede">
        CSAT Basic Numeracy and Data Interpretation (Class X level), played as a chain — how many puzzles in a row
        can you solve? Difficulty escalates as your chain grows; one wrong answer breaks it. No timer, no round
        limit — this is about how far you get, not how fast.
      </p>
      <QuantPuzzleChain />
    </>
  );
}
