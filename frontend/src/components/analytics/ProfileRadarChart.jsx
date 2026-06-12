import { RIASEC_TYPES } from "./chartUtils";

const toRadians = (degrees) => (Math.PI / 180) * degrees;

const getRadarPoint = (index, total, radius, center) => {
  const angle = toRadians(-90 + (360 / total) * index);

  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
};

function ProfileRadarChart({ results = [] }) {
  const center = 150;
  const radius = 92;
  const levels = [0.25, 0.5, 0.75, 1];
  const topCodes = new Set(results.slice(0, 3).map((item) => item.code));
  const chartResults = RIASEC_TYPES.map((type) =>
    results.find((item) => item.type === type)
  ).filter(Boolean);
  const polygonPoints = chartResults
    .map((item, index) => {
      const point = getRadarPoint(
        index,
        chartResults.length,
        radius * item.percent * 0.01,
        center
      );

      return `${point.x},${point.y}`;
    })
    .join(" ");

  if (chartResults.length === 0) {
    return null;
  }

  return (
    <div className="summary-radar-visual" aria-label="Biểu đồ mạng nhện RIASEC">
      <svg viewBox="0 0 300 300" role="img">
        <title>Biểu đồ radar RIASEC</title>
        {levels.map((level) => (
          <polygon
            key={level}
            className="summary-radar-grid"
            points={chartResults
              .map((_, index) => {
                const point = getRadarPoint(
                  index,
                  chartResults.length,
                  radius * level,
                  center
                );
                return `${point.x},${point.y}`;
              })
              .join(" ")}
          />
        ))}

        {chartResults.map((_, index) => {
          const point = getRadarPoint(index, chartResults.length, radius, center);
          return (
            <line
              key={index}
              className="summary-radar-axis"
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
            />
          );
        })}

        <polygon className="summary-radar-area" points={polygonPoints} />
        <polyline
          className="summary-radar-line"
          points={`${polygonPoints} ${polygonPoints.split(" ")[0]}`}
        />

        {chartResults.map((item, index) => {
          const valuePoint = getRadarPoint(
            index,
            chartResults.length,
            radius * item.percent * 0.01,
            center
          );
          const labelPoint = getRadarPoint(index, chartResults.length, radius + 30, center);
          const isTop = topCodes.has(item.code);

          return (
            <g key={item.type}>
              <circle
                className={isTop ? "summary-radar-dot top" : "summary-radar-dot"}
                cx={valuePoint.x}
                cy={valuePoint.y}
                r={isTop ? 5 : 4}
              />
              <text
                className={isTop ? "summary-radar-label top" : "summary-radar-label"}
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {item.code}
              </text>
              <text
                className="summary-radar-value"
                x={labelPoint.x}
                y={labelPoint.y + 15}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {item.percent}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default ProfileRadarChart;
