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
import { getSummaryElementName } from "../../utils/profileSummary";

const STATUS_META = {
  strong: {
    color: "#16a34a",
    label: "Nổi bật",
    range: "Từ 80% trở lên",
  },
  developing: {
    color: "#2563eb",
    label: "Đang phát triển",
    range: "51% đến 79%",
  },
  weak: {
    color: "#d97706",
    label: "Cần cải thiện",
    range: "Từ 50% trở xuống",
  },
  unknown: {
    color: "#64748b",
    label: "Chưa đủ dữ liệu",
    range: "Chưa có yếu tố khớp",
  },
};

const FILTER_OPTIONS = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: STATUS_META.strong.label, value: "strong" },
  { label: STATUS_META.developing.label, value: "developing" },
  { label: STATUS_META.weak.label, value: "weak" },
  { label: STATUS_META.unknown.label, value: "unknown" },
];

function getShortName(name) {
  if (name.length <= 18) {
    return name;
  }

  return `${name.slice(0, 17)}...`;
}

function getScorePercent(score) {
  if (score == null) {
    return null;
  }

  const value = Number(score);

  if (!Number.isFinite(value)) {
    return null;
  }

  const percent = value > 1 ? value : value * 100;

  return Math.max(0, Math.min(100, Math.round(percent)));
}

function getStatus(score) {
  if (score == null) {
    return "unknown";
  }

  if (score >= 80) {
    return "strong";
  }

  if (score <= 50) {
    return "weak";
  }

  return "developing";
}

function getAverageScore(items) {
  const scoredItems = items.filter((item) => item.hasScore);

  if (!scoredItems.length) {
    return null;
  }

  return Math.round(
    scoredItems.reduce((total, item) => total + item.score, 0) /
      scoredItems.length
  );
}

function sortCompetencyItems(items, direction) {
  return [...items].sort((a, b) => {
    if (!a.hasScore && !b.hasScore) {
      return a.order - b.order;
    }

    if (!a.hasScore) {
      return 1;
    }

    if (!b.hasScore) {
      return -1;
    }

    if (a.score !== b.score) {
      return direction === "asc" ? a.score - b.score : b.score - a.score;
    }

    return a.order - b.order;
  });
}

function CompetencyChartTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="summary-core-tooltip summary-competency-tooltip">
      <strong>{item.name}</strong>
      <span>{item.statusLabel}</span>
      <em>{item.hasScore ? `${item.score}%` : "N/A"}</em>
      <p>{item.description}</p>
      <small>{item.basisLabel}</small>
    </div>
  );
}

function CompetencyGroupsChart({ groups = [], limit = 6 }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState("desc");

  const chartItems = useMemo(
    () =>
      groups.map((group, index) => {
        const score = getScorePercent(group?.score);
        const status = getStatus(score);
        const statusMeta = STATUS_META[status];
        const name = String(group?.label || "Chưa đặt tên");
        const matchedElements = group?.matchedElements || [];

        return {
          basisLabel: matchedElements.length
            ? `Dựa trên: ${matchedElements
                .map((element) => getSummaryElementName(element))
                .join(", ")}`
            : group?.scoreLabel || statusMeta.range,
          color: statusMeta.color,
          description: group?.description || "Chưa có mô tả nhóm năng lực.",
          hasScore: score != null,
          id: group?.id || `${status}-${index}`,
          name,
          order: index,
          score: score ?? 0,
          shortName: getShortName(name),
          status,
          statusLabel: statusMeta.label,
        };
      }),
    [groups]
  );

  const visibleItems = useMemo(() => {
    const filteredItems =
      statusFilter === "all"
        ? chartItems
        : chartItems.filter((item) => item.status === statusFilter);

    return sortCompetencyItems(filteredItems, sortDirection).slice(0, limit);
  }, [chartItems, limit, sortDirection, statusFilter]);

  const scoredVisibleItems = visibleItems.filter((item) => item.hasScore);
  const strongCount = visibleItems.filter((item) => item.status === "strong").length;
  const weakCount = visibleItems.filter((item) => item.status === "weak").length;
  const averageScore = getAverageScore(visibleItems);
  const highestItem = scoredVisibleItems.reduce(
    (best, item) => (item.score > (best?.score ?? -1) ? item : best),
    null
  );

  const stats = [
    {
      icon: Trophy,
      label: "Nhóm nổi bật",
      sub: "Từ 80% trở lên",
      tone: "success",
      value: `${strongCount}/${scoredVisibleItems.length}`,
    },
    {
      icon: Gauge,
      label: "Điểm trung bình",
      sub: `Trong ${scoredVisibleItems.length} nhóm có dữ liệu`,
      tone: "primary",
      value: averageScore == null ? "N/A" : `${averageScore}%`,
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
    <div className="summary-core-dashboard summary-competency-dashboard">
      <div className="summary-core-dashboard-heading">
        <div>
          <p className="summary-dashboard-eyebrow">Nhóm năng lực</p>
          <h2>Dashboard nhóm năng lực</h2>
          <p>
            Tổng hợp 6 nhóm năng lực lớn từ các yếu tố cốt lõi để học sinh nhìn
            nhanh điểm mạnh và vùng cần rèn luyện.
          </p>
        </div>

        <div className="summary-core-controls">
          <label>
            <span>Trạng thái</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
                    content={<CompetencyChartTooltip />}
                    cursor={{ fill: "rgba(15, 118, 110, 0.07)" }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke={STATUS_META.strong.color}
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
                    stroke={STATUS_META.weak.color}
                    strokeDasharray="4 4"
                    label={{
                      fill: "#b45309",
                      fontSize: 12,
                      fontWeight: 800,
                      position: "insideTopRight",
                      value: "Mốc 50%",
                    }}
                  />
                  <Bar dataKey="score" maxBarSize={58} radius={[8, 8, 0, 0]}>
                    {visibleItems.map((item) => (
                      <Cell fill={item.color} key={item.id} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="summary-core-legend">
            {Object.entries(STATUS_META).map(([status, meta]) => (
              <span key={status}>
                <i style={{ backgroundColor: meta.color }} />
                {meta.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="summary-empty-state">
          <p>Không có nhóm năng lực phù hợp với bộ lọc hiện tại.</p>
        </div>
      )}
    </div>
  );
}

export default CompetencyGroupsChart;
