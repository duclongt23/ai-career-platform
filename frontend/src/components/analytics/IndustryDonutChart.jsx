const DONUT_COLORS = [
  "#2563eb",
  "#0f766e",
  "#f97316",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#9333ea",
];

const getClusterName = (career) =>
  career.careerCluster || career.field || "Chua phan nhom";

function polarToCartesian(center, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function describeArc(center, radius, startAngle, endAngle) {
  const start = polarToCartesian(center, radius, endAngle);
  const end = polarToCartesian(center, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

function IndustryDonutChart({ recommendations = [] }) {
  const total = recommendations.length;
  const groups = Object.entries(
    recommendations.reduce((result, career) => {
      const cluster = getClusterName(career);
      result[cluster] = (result[cluster] || 0) + 1;
      return result;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  if (total === 0 || groups.length === 0) {
    return null;
  }

  const segments = groups.reduce(
    (state, group, index) => {
      const degrees = (group.count / total) * 360;

      return {
        angle: state.angle + degrees,
        items: [
          ...state.items,
          {
            ...group,
            color: DONUT_COLORS[index % DONUT_COLORS.length],
            isFullCircle: degrees >= 360,
            path: describeArc(100, 72, state.angle, state.angle + degrees),
            percent: Math.round((group.count / total) * 100),
          },
        ],
      };
    },
    { angle: 0, items: [] }
  ).items;

  return (
    <section className="industry-donut-card card">
      <div className="industry-donut-heading">
        <div>
          <span className="recommendation-eyebrow">Phan bo nhom nganh</span>
          <h2>15 nghề gợi ý đang nghiêng về nhóm nào?</h2>
        </div>
        <strong>{total} nghề</strong>
      </div>

      <div className="industry-donut-content">
        <div className="industry-donut-visual" aria-label="Bieu do donut nhom nganh">
          <svg viewBox="0 0 200 200" role="img">
            <title>Phan bo nghe phu hop theo nhom nganh</title>
            <circle className="industry-donut-base" cx="100" cy="100" r="72" />
            {segments.map((segment) =>
              segment.isFullCircle ? (
                <circle
                  className="industry-donut-segment"
                  cx="100"
                  cy="100"
                  key={segment.name}
                  r="72"
                  stroke={segment.color}
                />
              ) : (
                <path
                  className="industry-donut-segment"
                  d={segment.path}
                  key={segment.name}
                  stroke={segment.color}
                />
              )
            )}
            <text className="industry-donut-total" x="100" y="94" textAnchor="middle">
              {total}
            </text>
            <text className="industry-donut-caption" x="100" y="114" textAnchor="middle">
              nghe goi y
            </text>
          </svg>
        </div>

        <div className="industry-donut-legend">
          {segments.map((segment) => (
            <article key={segment.name}>
              <span>
                <i style={{ backgroundColor: segment.color }} />
                {segment.name}
              </span>
              <strong>
                {segment.count} nghề · {segment.percent}%
              </strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default IndustryDonutChart;
