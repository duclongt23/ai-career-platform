import { getElementDisplayName } from "./chartUtils";

const normalizeCode = (code) =>
  String(code || "")
    .trim()
    .toLowerCase();

function JobMatchCompareChart({
  careerElements = [],
  profileElementScores = [],
  limit = 5,
}) {
  const profileScoreMap = new Map(
    profileElementScores.map((score) => [
      normalizeCode(score.code),
      Number(score.finalScore || 0),
    ])
  );
  const rows = [...careerElements]
    .sort((a, b) => Number(b.importance || 0) - Number(a.importance || 0))
    .map((element) => ({
      code: element.code,
      label: getElementDisplayName(element),
      profileScore: profileScoreMap.get(normalizeCode(element.code)) || 0,
      careerImportance: Number(element.importance || 0),
    }));
  const chartRows = rows.filter((row) => row.profileScore > 0).slice(0, limit);
  const learningRows = rows.filter((row) => row.profileScore <= 0).slice(0, limit);

  if (chartRows.length === 0 && learningRows.length === 0) {
    return null;
  }

  return (
    <section className="career-match-analytics">
      <div className="career-match-heading">
        <div>
          <span className="career-match-eyebrow">Match analytics</span>
          <h3>So sánh hồ sơ của bạn với yêu cầu công việc</h3>
        </div>
        {chartRows.length > 0 && (
          <div className="career-match-legend">
            <span>
              <i className="profile" />
              Mức độ bạn có
            </span>
            <span>
              <i className="career" />
              Mức độ nghề cần
            </span>
          </div>
        )}
      </div>

      {chartRows.length > 0 && (
        <div className="career-match-chart">
          {chartRows.map((row) => {
            const profilePercent = Math.max(
              0,
              Math.min(Math.round(row.profileScore * 100), 100)
            );
            const careerPercent = Math.max(
              0,
              Math.min(Math.round(row.careerImportance * 100), 100)
            );
            const gap = profilePercent - careerPercent;

            return (
              <article className="career-match-row" key={row.code}>
                <div className="career-match-label">
                  <strong>{row.label}</strong>
                  <span>{gap >= 0 ? "Đang khớp tốt" : "Cần bổ sung"}</span>
                </div>
                <div className="career-match-pair">
                  <div className="career-match-bar profile">
                    <div style={{ width: `${profilePercent}%` }} />
                  </div>
                  <div className="career-match-bar career">
                    <div style={{ width: `${careerPercent}%` }} />
                  </div>
                </div>
                <div className="career-match-values">
                  <span>{profilePercent}%</span>
                  <span>{careerPercent}%</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {learningRows.length > 0 && (
        <div className="career-match-learning">
          <h4>Những yếu tố phải học</h4>
          <ul>
            {learningRows.map((row) => (
              <li key={row.code}>
                <span>{row.label}</span>
                <strong>{Math.round(row.careerImportance * 100)}%</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default JobMatchCompareChart;
