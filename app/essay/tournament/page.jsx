import EssayTournament from "../../../components/EssayTournament.jsx";

export default function EssayTournamentPage() {
  return (
    <>
      <p style={{ fontSize: 12.5, marginBottom: 12 }}>
        <a href="/essay">← Browse essay topics instead</a>
      </p>
      <h1>Essay Tournament</h1>
      <p className="lede">
        One topic per round, forced across a different category each time — Philosophy, Economy, Environment,
        Polity, and more — so you can't just write on your one comfortable theme. Clear 33% to advance; fall short
        and the run ends. No timer, no fixed length — how many rounds can you clear?
      </p>
      <EssayTournament />
    </>
  );
}
