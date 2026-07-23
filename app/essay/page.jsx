import EssayWorkspace from "../../components/EssayWorkspace.jsx";

export default function EssayPage() {
  return (
    <>
      <h1>Essay practice</h1>
      <p className="lede">
        Browse real past-year UPSC essay topics or coaching-guidance practice topics (always labeled which is
        which), get an AI planning guide if you want one, write a full essay, and get holistic feedback — content,
        structure, balance, and language, the same criteria the real paper is judged on.
      </p>
      <EssayWorkspace />
    </>
  );
}
