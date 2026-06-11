import {
  CORE_TYPE_COLORS,
  CORE_TYPE_LABELS,
  getElementDisplayName,
} from "./chartUtils";

function TopElementsBarChart({ scores = [], limit = 10 }) {
  const topScores = scores.slice(0, limit);
  const maxScore = Math.max(
    ...topScores.map((score) => Number(score.finalScore || 0)),
    0.01
  );

  return (
    <div className="summary-core-bars">
      {topScores.map((score, index) => {
        const value = Number(score.finalScore || 0);
        const width = Math.round((value / maxScore) * 100);
        const color = CORE_TYPE_COLORS[score.type] || "#64748b";

        return (
          <article className="summary-core-row" key={score.code}>
            <span className="summary-core-rank">#{index + 1}</span>
            <div className="summary-core-info">
              <strong>{getElementDisplayName(score)}</strong>
              <span>{CORE_TYPE_LABELS[score.type] || score.type}</span>
            </div>
            <div className="summary-core-track">
              <div style={{ background: color, width: `${width}%` }} />
            </div>
            <span className="summary-core-score">{Math.round(value * 100)}%</span>
          </article>
        );
      })}
    </div>
  );
}

export default TopElementsBarChart;
