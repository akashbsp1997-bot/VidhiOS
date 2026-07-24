import FillBlanks from "../../components/FillBlanks.jsx";

export default function FillBlanksPage() {
  return (
    <>
      <h1>Fill the Blanks</h1>
      <p className="lede">
        Some of a real passage gets blanked out — sometimes just a couple of lines, sometimes most of it. Tap the
        right points back into place. No AI grading here; it's scored instantly against the real content.
      </p>
      <FillBlanks />
    </>
  );
}
