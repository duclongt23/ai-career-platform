import { useMemo, useState } from "react";
import { Gauge, TrendingUp, TriangleAlert, Trophy } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CORE_TYPE_COLORS,
  CORE_TYPE_LABELS,
  getElementDisplayName,
} from "./chartUtils";

const FALLBACK_COLOR = "#64748b";
const FALLBACK_TYPE = "other";

function getScorePercent(score) {
  const value = Number(score || 0);
  const percent = value > 1 ? value : value * 100;

  return Math.max(0, Math.min(100, Math.round(percent)));
}

function getShortName(name) {
  if (name.length <= 20) {
    return name;
  }

  return `${name.slice(0, 19)}...`;
}

function getAverageScore(items) {
  if (!items.length) {
    return 0;
  }

  return Math.round(
    items.reduce((total, item) => total + Number(item.score || 0), 0) /
      items.length
  );
}

function CoreChartTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="summary-core-tooltip">
      <strong>{item.name}</strong>
      <span>{item.group}</span>
      <em>{item.score}%</em>
    </div>
  );
}

function TopElementsBarChart({ scores = [], limit = 10 }) {
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState("desc");

  const chartItems = useMemo(
    () =>
      scores.map((score, index) => {
        const type = score?.type || FALLBACK_TYPE;
        const name = String(getElementDisplayName(score || {}) || "Chưa đặt tên");

        return {
          id: score?.code || `${type}-${index}`,
          color: CORE_TYPE_COLORS[type] || FALLBACK_COLOR,
          group: CORE_TYPE_LABELS[type] || score?.type || "Khác",
          name,
          score: getScorePercent(score?.finalScore),
          shortName: getShortName(name),
          type,
        };
      }),
    [scores]
  );

  const groupOptions = useMemo(() => {
    const optionMap = new Map();

    chartItems.forEach((item) => {
      if (!optionMap.has(item.type)) {
        optionMap.set(item.type, item.group);
      }
    });

    return [...optionMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [chartItems]);

  const visibleItems = useMemo(() => {
    const filteredItems =
      groupFilter === "all"
        ? chartItems
        : chartItems.filter((item) => item.type === groupFilter);

    return [...filteredItems]
      .sort((a, b) =>
        sortDirection === "asc" ? a.score - b.score : b.score - a.score
      )
      .slice(0, limit);
  }, [chartItems, groupFilter, limit, sortDirection]);

  const averageScore = getAverageScore(visibleItems);
  const strongCount = visibleItems.filter((item) => item.score >= 80).length;
  const weakCount = visibleItems.filter((item) => item.score <= 50).length;
  const highestItem = visibleItems.reduce(
    (best, item) => (item.score > (best?.score ?? -1) ? item : best),
    null
  );

  const stats = [
    {
      icon: Trophy,
      label: "Yếu tố nổi bật",
      sub: "Từ 80% trở lên",
      tone: "success",
      value: `${strongCount}/${visibleItems.length}`,
    },
    {
      icon: Gauge,
      label: "Điểm trung bình",
      sub: `Trong ${visibleItems.length} yếu tố đang xem`,
      tone: "primary",
      value: `${averageScore}%`,
    },
    {
      icon: TrendingUp,
      label: "Điểm cao nhất",
      sub: highestItem?.name || "Chưa có dữ liệu",
      tone: "accent",
      value: highestItem ? `${highestItem.score}%` : "N/A",
    },
    {
      icon: TriangleAlert,
      label: "Cần cải thiện",
      sub: "Từ 50% trở xuống",
      tone: weakCount > 0 ? "warning" : "neutral",
      value: String(weakCount),
    },
  ];

  return (
    <div className="summary-core-dashboard">
      <div className="summary-core-dashboard-heading">
        <div>
          <p className="summary-dashboard-eyebrow">Năng lực cốt lõi</p>
          <h2>Top 10 yếu tố năng lực cốt lõi</h2>
          <p>So sánh điểm nổi bật theo từng nhóm năng lực.</p>
        </div>

        <div className="summary-core-controls">
          <label>
            <span>Nhóm</span>
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
            >
              <option value="all">Tất cả nhóm</option>
              {groupOptions.map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Sắp xếp</span>
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value)}
            >
              <option value="desc">Cao xuống thấp</option>
              <option value="asc">Thấp lên cao</option>
            </select>
          </label>
        </div>
      </div>

      <div className="summary-core-stat-grid">
        {stats.map((item) => {
          const StatIcon = item.icon;

          return (
            <article
              className="summary-core-stat-card"
              data-tone={item.tone}
              key={item.label}
            >
              <div className="summary-core-stat-heading">
                <span>{item.label}</span>
                <StatIcon aria-hidden="true" size={20} strokeWidth={2.4} />
              </div>
              <strong>{item.value}</strong>
              <small>{item.sub}</small>
            </article>
          );
        })}
      </div>

      {visibleItems.length > 0 ? (
        <>
          <div className="summary-core-chart-scroll">
            <div className="summary-core-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={visibleItems}
                  margin={{ top: 24, right: 18, bottom: 70, left: -6 }}
                >
                  <CartesianGrid
                    stroke="#d9e2d7"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="shortName"
                    height={78}
                    interval={0}
                    textAnchor="end"
                    tick={{ fill: "#4f5f6b", fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                    angle={-24}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: "#4f5f6b", fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip
                    content={<CoreChartTooltip />}
                    cursor={{ fill: "rgba(15, 118, 110, 0.07)" }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#16a34a"
                    strokeDasharray="4 4"
                    label={{
                      fill: "#15803d",
                      fontSize: 12,
                      fontWeight: 800,
                      position: "insideTopRight",
                      value: "Mốc 80%",
                    }}
                  />
                  <ReferenceLine
                    y={50}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    label={{
                      fill: "#b45309",
                      fontSize: 12,
                      fontWeight: 800,
                      position: "insideTopRight",
                      value: "Mốc 50%",
                    }}
                  />
                  <Bar dataKey="score" maxBarSize={56} radius={[8, 8, 0, 0]}>
                    {visibleItems.map((item) => (
                      <Cell fill={item.color} key={item.id} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="summary-core-legend">
            {groupOptions.map(([type, label]) => (
              <span key={type}>
                <i style={{ backgroundColor: CORE_TYPE_COLORS[type] || FALLBACK_COLOR }} />
                {label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="summary-empty-state">
          <p>Không có yếu tố phù hợp với bộ lọc hiện tại.</p>
        </div>
      )}
    </div>
  );
}

export default TopElementsBarChart;
