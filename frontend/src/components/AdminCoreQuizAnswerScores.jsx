function formatScore(score) {
  return Number(score || 0)
    .toFixed(4)
    .replace(/\.?0+$/, "");
}

function AdminCoreQuizAnswerScores({ scores = [] }) {
  if (scores.length === 0) {
    return <small className="core-admin-answer-scores">Khong co mapping diem</small>;
  }

  return (
    <small className="core-admin-answer-scores">
      {scores.map(({ code, score }) => `${code}: ${formatScore(score)}`).join(" | ")}
    </small>
  );
}

export default AdminCoreQuizAnswerScores;
