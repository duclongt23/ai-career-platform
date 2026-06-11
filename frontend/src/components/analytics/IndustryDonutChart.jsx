import { DEFAULT_RECOMMENDATION_LIMIT } from "../../constants/recommendations";
import { normalizeCareerClusters } from "../../utils/careerCluster";

const INDUSTRY_BAR_COLORS = [
  "#2563eb",
  "#0f766e",
  "#f97316",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#9333ea",
  "#ca8a04",
  "#db2777",
  "#475569",
  "#16a34a",
];

const getClusterNames = (career) => {
  const clusters = normalizeCareerClusters(career.careerCluster || career.field);

  return clusters.length ? clusters : ["Chưa phân nhóm"];
};

function IndustryDonutChart({ recommendations = [] }) {
  const careerTotal = recommendations.length;
  const groups = Object.entries(
    recommendations.reduce((result, career) => {
      getClusterNames(career).forEach((cluster) => {
        result[cluster] = (result[cluster] || 0) + 1;
      });
      return result;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = groups.reduce((count, group) => count + group.count, 0);

  if (careerTotal === 0 || total === 0 || groups.length === 0) {
    return null;
  }

  const segments = groups.map((group, index) => ({
    ...group,
    color: INDUSTRY_BAR_COLORS[index % INDUSTRY_BAR_COLORS.length],
    percent: Math.round((group.count / total) * 100),
  }));
  const maxPercent = Math.max(...segments.map((segment) => segment.percent));
  const axisMax = Math.max(50, Math.ceil(maxPercent / 10) * 10);
  const ticks = Array.from({ length: axisMax / 10 + 1 }, (_, index) => index * 10);

  return (
    <section className="industry-donut-card card">
      <div className="industry-donut-heading">
        <div>
          <span className="recommendation-eyebrow">Phân bổ nhóm ngành</span>
          <h2>{DEFAULT_RECOMMENDATION_LIMIT} nghề gợi ý đang nghiêng về nhóm nào?</h2>
        </div>
      </div>

      <div className="industry-bar-list" aria-label="Biểu đồ thanh ngang nhóm ngành">
        <div className="industry-bar-plot">
          {segments.map((segment) => (
            <article className="industry-bar-row" key={segment.name}>
              <div className="industry-bar-label">{segment.name}</div>
              <div className="industry-bar-track">
                {ticks.map((tick) => (
                  <span
                    className="industry-bar-gridline"
                    key={tick}
                    style={{ left: `${(tick / axisMax) * 100}%` }}
                  />
                ))}
                <div
                  className="industry-bar-fill"
                  style={{
                    backgroundColor: segment.color,
                    width: `${(segment.percent / axisMax) * 100}%`,
                  }}
                >
                  <span>{segment.percent}%</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="industry-bar-axis" aria-hidden="true">
          <span />
          <div>
            {ticks.map((tick) => (
              <small key={tick} style={{ left: `${(tick / axisMax) * 100}%` }}>
                {tick}%
              </small>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default IndustryDonutChart;
