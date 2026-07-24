import EssayWorkspace from "../../components/EssayWorkspace.jsx";

export default function EssayPage() {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>Essay practice</h1>
          <p className="lede">
            Browse real past-year UPSC essay topics or coaching-guidance practice topics (always labeled which is
            which), get an AI planning guide if you want one, write a full essay, and get holistic feedback —
            content, structure, balance, and language, the same criteria the real paper is judged on.
          </p>
        </div>
        <a className="btn btn-primary" href="/essay/tournament" style={{ whiteSpace: "nowrap" }}>
          🏆 Play Essay Tournament →
        </a>
      </div>
      <EssayWorkspace />
    </>
  );
}
