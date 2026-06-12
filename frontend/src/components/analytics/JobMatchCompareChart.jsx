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
                  <span className={gap >= 0 ? "match-good" : "match-gap"}>
                    {gap >= 0 ? "Đang khớp tốt" : "Cần bổ sung"}
                  </span>
                </div>

                {/* Tách thành 2 dòng metric để thanh và số không bị dính nhau khi tên yếu tố dài. */}
                <div className="career-match-comparison">
                  <div className="career-match-metric">
                    <span>Bạn có</span>
                    <div className="career-match-bar profile">
                      <div style={{ width: `${profilePercent}%` }} />
                    </div>
                    <strong>{profilePercent}%</strong>
                  </div>
                  <div className="career-match-metric">
                    <span>Nghề cần</span>
                    <div className="career-match-bar career">
                      <div style={{ width: `${careerPercent}%` }} />
                    </div>
                    <strong>{careerPercent}%</strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {learningRows.length > 0 && (
        <div className="career-match-learning">
          <div className="career-match-learning-heading">
            <h4>Những yếu tố nên học thêm</h4>
            <p>
              Các năng lực/kỹ năng quan trọng với nghề này nhưng hồ sơ hiện chưa
              có tín hiệu rõ.
            </p>
          </div>
          <ul className="career-match-learning-list">
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
