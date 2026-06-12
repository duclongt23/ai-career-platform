import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import ProfileRadarChart from "../components/analytics/ProfileRadarChart";
import TopElementsBarChart from "../components/analytics/TopElementsBarChart";
import {
  buildRiasecResults,
  CORE_TYPE_COLORS,
  CORE_TYPE_LABELS,
} from "../components/analytics/chartUtils";
import { normalizeCareerClusters } from "../utils/careerCluster";
import {
  buildCompetencyGroups,
  buildDevelopmentAreas,
  getSummaryElementName,
} from "../utils/profileSummary";

function getInsightSourceLabel(source) {
  if (source === "ai") {
    return "AI insight";
  }

  if (source === "fallback") {
    return "Dự phòng theo dữ liệu";
  }

  return "Đang phân tích";
}

function getDevelopmentPriorityScore(area, maxCount) {
  const countScore = maxCount > 0 ? Number(area.count || 0) / maxCount : 0;
  const gapScore = Math.min(Math.max(Number(area.averageGap || 0), 0), 1);
  const importanceScore = Math.min(
    Math.max(Number(area.averageImportance || 0), 0),
    1
  );

  return Math.max(
    12,
    Math.min(
      100,
      Math.round(countScore * 58 + gapScore * 28 + importanceScore * 14)
    )
  );
}

function getDevelopmentPriorityLabel(score) {
  if (score >= 78) {
    return "Ưu tiên cao";
  }

  if (score >= 52) {
    return "Nên rèn luyện";
  }

  return "Theo dõi thêm";
}

const DEVELOPMENT_PRIORITY_COLORS = [
  "#d97706",
  "#0d9488",
  "#7c3aed",
  "#2563eb",
  "#be123c",
];

const COMPETENCY_COLORS = [
  "#7c3aed",
  "#0d9488",
  "#d97706",
  "#2563eb",
  "#be123c",
  "#15803d",
];

const CLUSTER_COLORS = [
  "#0f766e",
  "#d97706",
  "#7c3aed",
  "#2563eb",
  "#be123c",
  "#15803d",
];

function getScorePercent(score) {
  if (score == null) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(Number(score || 0) * 100)));
}

function buildClusterConicGradient(items, total) {
  if (!items.length || total <= 0) {
    return "#e2ebe0";
  }

  let start = 0;
  const segments = items.map((item, index) => {
    const size = (Number(item.count || 0) / total) * 100;
    const end = start + size;
    const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
    const segment = `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    start = end;

    return segment;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function DiscoverySummaryDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [profile, setProfile] = useState(null);
  const [coreResult, setCoreResult] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [profileInsights, setProfileInsights] = useState(null);
  const [insightIndex, setInsightIndex] = useState(0);
  const [isInsightLoading, setIsInsightLoading] = useState(Boolean(token));
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login", {
        state: {
          message: "Yêu cầu đăng nhập để xem dashboard tổng kết",
          from: "/discovery/dashboard",
        },
      });
      return undefined;
    }

    let isMounted = true;

    Promise.allSettled([
      api.get("/profile"),
      api.get("/profile/core-quiz/result"),
      api.get("/careers/recommendations/me"),
      api.get("/riasec/questions"),
    ])
      .then(
        ([profileResponse, coreResponse, recommendationsResponse, questionsResponse]) => {
          if (!isMounted) return;

          if (profileResponse.status === "fulfilled") {
            setProfile(profileResponse.value.data);
          } else {
            setError("Không tải được hồ sơ tổng kết. Vui lòng thử lại sau.");
          }

          if (coreResponse.status === "fulfilled") {
            setCoreResult(coreResponse.value.data);
          }

          if (recommendationsResponse.status === "fulfilled") {
            setRecommendations(
              recommendationsResponse.value.data.recommendations || []
            );
          }

          if (questionsResponse.status === "fulfilled") {
            setQuestions(questionsResponse.value.data || []);
          }
        }
      )
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    // Insight AI có thể chậm hơn các biểu đồ, nên tách request để dashboard vẫn mở nhanh.
    api
      .get("/profile/summary-insights")
      .then((response) => {
        if (isMounted) {
          setProfileInsights(response.data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setProfileInsights(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsInsightLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [navigate, token]);

  const riasecResults = useMemo(
    () => buildRiasecResults(profile?.riasecScores, profile?.riasecCode, questions),
    [profile, questions]
  );
  const topRiasec = riasecResults.slice(0, 3);
  const coreScores = useMemo(() => {
    const scores = coreResult?.elementScores || profile?.elementScores || [];

    return [...scores].sort(
      (a, b) => Number(b.finalScore || 0) - Number(a.finalScore || 0)
    );
  }, [coreResult, profile]);
  const competencyGroups = useMemo(
    () => buildCompetencyGroups(coreScores),
    [coreScores]
  );
  const developmentAreas = useMemo(
    () => buildDevelopmentAreas({ recommendations }),
    [recommendations]
  );
  const maxDevelopmentCount = Math.max(
    ...developmentAreas.map((area) => area.count),
    1
  );
  const hasRiasec = Boolean(profile?.riasecScores || profile?.riasecCode);
  const hasCoreScores = coreScores.length > 0;
  const careerClusterSummary = useMemo(() => {
    const counts = new Map();

    recommendations.forEach((career) => {
      const clusters = normalizeCareerClusters(career.careerCluster);
      const normalizedClusters = clusters.length ? clusters : ["Chưa phân nhóm"];

      normalizedClusters.forEach((cluster) => {
        counts.set(cluster, (counts.get(cluster) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .map(([cluster, count]) => ({ cluster, count }))
      .sort((a, b) => b.count - a.count || a.cluster.localeCompare(b.cluster))
      .slice(0, 5);
  }, [recommendations]);
  const hasCareerClusters = careerClusterSummary.length > 0;
  const careerClusterTotal = useMemo(
    () =>
      careerClusterSummary.reduce(
        (total, item) => total + Number(item.count || 0),
        0
      ),
    [careerClusterSummary]
  );
  const careerClusterGradient = useMemo(
    () => buildClusterConicGradient(careerClusterSummary, careerClusterTotal),
    [careerClusterSummary, careerClusterTotal]
  );
  const insights = profileInsights?.insights || [];
  const activeInsightIndex =
    insights.length > 0 ? Math.min(insightIndex, insights.length - 1) : 0;
  const activeInsight = insights[activeInsightIndex];
  const canNavigateInsights = insights.length > 1;
  const goToPreviousInsight = () => {
    if (!canNavigateInsights) return;

    setInsightIndex((currentIndex) =>
      currentIndex === 0 ? insights.length - 1 : currentIndex - 1
    );
  };
  const goToNextInsight = () => {
    if (!canNavigateInsights) return;

    setInsightIndex((currentIndex) => (currentIndex + 1) % insights.length);
  };

  if (isLoading) {
    return (
      <section className="card summary-dashboard-card">
        <p className="muted">Đang tải dashboard tổng kết...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card summary-dashboard-card">
        <p className="error">{error}</p>
      </section>
    );
  }

  return (
    <div className="summary-dashboard-page">
      <section className="summary-dashboard-hero">
        <p className="summary-dashboard-eyebrow">Tổng kết hồ sơ</p>
        <h1>Nhìn lại hồ sơ khám phá bản thân trước khi xem nghề</h1>
        <p>
          Dashboard gom dữ liệu RIASEC, năng lực cốt lõi và nghề gợi ý để học
          sinh hiểu nhanh mình đang nổi bật ở đâu, nên phát triển gì và nên đọc
          nhóm nghề nào trước.
        </p>
      </section>

      <section className="card summary-dashboard-card">
        <div className="summary-section-heading">
          <div>
            <p className="summary-dashboard-eyebrow">Tổng quan hồ sơ</p>
            <h2>3-5 insight chính về học sinh</h2>
          </div>
          <span>{getInsightSourceLabel(profileInsights?.source)}</span>
        </div>

        {isInsightLoading && insights.length === 0 ? (
          <p className="summary-insight-status">
            AI đang viết phần tổng quan từ dữ liệu hồ sơ...
          </p>
        ) : activeInsight ? (
          <div className="summary-insight-carousel">
            <div className="summary-insight-stage" aria-live="polite">
              {/* Mỗi lần chỉ nổi bật một insight để học sinh đọc nhanh, không bị ngợp bởi nhiều đoạn chữ cùng lúc. */}
              <article className="summary-insight-card" key={`${activeInsight.title}-${activeInsightIndex}`}>
                <span className="summary-insight-number">
                  {String(activeInsightIndex + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{activeInsight.title}</h3>
                  <p>{activeInsight.description}</p>
                </div>
              </article>
            </div>

            <div className="summary-insight-controls">
              <button
                aria-label="Xem insight trước"
                className="summary-insight-nav"
                disabled={!canNavigateInsights}
                onClick={goToPreviousInsight}
                type="button"
              >
                ←
              </button>
              <div className="summary-insight-progress" aria-label="Vị trí insight">
                {insights.map((insight, index) => (
                  <button
                    aria-label={`Xem insight ${index + 1}`}
                    aria-pressed={index === activeInsightIndex}
                    className={index === activeInsightIndex ? "active" : ""}
                    key={`${insight.title}-${index}`}
                    onClick={() => setInsightIndex(index)}
                    type="button"
                  />
                ))}
              </div>
              <button
                aria-label="Xem insight tiếp theo"
                className="summary-insight-nav"
                disabled={!canNavigateInsights}
                onClick={goToNextInsight}
                type="button"
              >
                →
              </button>
              <span className="summary-insight-count">
                {activeInsightIndex + 1}/{insights.length}
              </span>
            </div>
          </div>
        ) : (
          <div className="summary-empty-state">
            <p>Chưa có đủ dữ liệu để tạo tổng quan hồ sơ.</p>
            <Link className="workflow-next-action" to="/discovery/core-quiz">
              Bổ sung dữ liệu hồ sơ
            </Link>
          </div>
        )}
      </section>

      <section className="card summary-dashboard-card">
        <div className="summary-section-heading">
          <div>
            <p className="summary-dashboard-eyebrow">Vùng có thể phát triển</p>
            <h2>Ưu tiên rèn luyện theo nghề được gợi ý</h2>
          </div>
          <span>{developmentAreas.length} vùng ưu tiên</span>
        </div>

        {developmentAreas.length > 0 ? (
          <div className="summary-growth-grid">
            {developmentAreas.map((area, index) => {
              const priorityScore = getDevelopmentPriorityScore(
                area,
                maxDevelopmentCount
              );
              const priorityColor =
                DEVELOPMENT_PRIORITY_COLORS[
                  index % DEVELOPMENT_PRIORITY_COLORS.length
                ];

              return (
                <article
                  className="summary-growth-card"
                  key={area.code}
                  style={{
                    "--summary-ring-angle": `${priorityScore * 3.6}deg`,
                    "--summary-ring-color": priorityColor,
                  }}
                >
                  <div
                    className="summary-growth-ring"
                    aria-label={`Mức ưu tiên ${getSummaryElementName(area)}: ${priorityScore}/100`}
                  >
                    <strong>{priorityScore}</strong>
                    <span>/100</span>
                  </div>
                  <div className="summary-growth-card-body">
                    <div className="summary-growth-card-heading">
                      <span>Ưu tiên #{index + 1}</span>
                      <strong>{getSummaryElementName(area)}</strong>
                    </div>
                    <div className="summary-growth-meta">
                      <span>{area.count} nghề</span>
                      <strong>{getDevelopmentPriorityLabel(priorityScore)}</strong>
                    </div>
                    {area.careerTitles.length > 0 && (
                      <div className="summary-growth-careers">
                        {area.careerTitles.slice(0, 2).map((title) => (
                          <span key={title}>{title}</span>
                        ))}
                        {area.careerTitles.length > 2 && (
                          <span>+{area.careerTitles.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="summary-empty-state">
            <p>
              Chưa có vùng phát triển rõ từ danh sách nghề gợi ý hiện tại.
            </p>
            <Link className="workflow-next-action" to="/discovery/recommendations">
              Xem gợi ý nghề
            </Link>
          </div>
        )}
      </section>

      <section className="card summary-dashboard-card">
        <div className="summary-section-heading">
          <div>
            <p className="summary-dashboard-eyebrow">Nhóm năng lực</p>
            <h2>Gauge chart nhóm năng lực</h2>
          </div>
          <span>{competencyGroups.length} nhóm</span>
        </div>

        {hasCoreScores ? (
          <div className="summary-competency-grid">
            {competencyGroups.map((group, index) => {
              const scorePercent = getScorePercent(group.score);
              const gaugeColor =
                COMPETENCY_COLORS[index % COMPETENCY_COLORS.length];

              return (
                <article
                  className="summary-competency-card"
                  key={group.id}
                  style={{
                    "--competency-angle": `${scorePercent * 3.6}deg`,
                    "--competency-color": gaugeColor,
                  }}
                >
                  <div
                    className="summary-competency-gauge"
                    aria-label={`${group.label}: ${group.scoreLabel}`}
                  >
                    <strong>{group.score == null ? "N/A" : group.scoreLabel}</strong>
                  </div>
                  <div className="summary-competency-copy">
                    <strong>{group.label}</strong>
                    <span>{group.description}</span>
                    <small>
                      {group.matchedElements.length > 0
                        ? `Dựa trên: ${group.matchedElements
                            .map((element) => getSummaryElementName(element))
                            .join(", ")}`
                        : group.scoreLabel}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="summary-empty-state">
            <p>Chưa có kết quả Core Quiz để nhóm năng lực.</p>
            <Link className="workflow-next-action" to="/discovery/core-quiz">
              Làm Core Quiz
            </Link>
          </div>
        )}
      </section>

      <section className="card summary-dashboard-card">
        <div className="summary-section-heading">
          <div>
            <p className="summary-dashboard-eyebrow">Radar Chart - Holland Codes</p>
            <h2>Mạng nhện sở thích RIASEC</h2>
          </div>
          {topRiasec.length > 0 && (
            <strong>{topRiasec.map((item) => item.code).join("")}</strong>
          )}
        </div>

        {hasRiasec ? (
          <div className="summary-radar-layout">
            <ProfileRadarChart results={riasecResults} />
            <div className="summary-riasec-list">
              {topRiasec.map((item, index) => (
                <article key={item.type}>
                  <span>Top {index + 1}</span>
                  <strong>
                    {item.code} - {item.label}
                  </strong>
                  <small>{item.percent}%</small>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="summary-empty-state">
            <p>Chưa có điểm RIASEC để hiển thị radar.</p>
            <Link className="workflow-next-action" to="/discovery/riasec">
              Làm bài RIASEC
            </Link>
          </div>
        )}
      </section>

      <section className="card summary-dashboard-card">
        <div className="summary-section-heading">
          <div>
            <p className="summary-dashboard-eyebrow">Career Cluster</p>
            <h2>Nhóm ngành nổi bật trong gợi ý nghề</h2>
          </div>
          {recommendations.length > 0 && (
            <span>{recommendations.length} nghề đã phân tích</span>
          )}
        </div>

        {hasCareerClusters ? (
          <div className="summary-cluster-donut-layout">
            <div
              className="summary-cluster-donut"
              style={{ background: careerClusterGradient }}
              aria-label="Donut chart nhóm ngành nổi bật"
            >
              <div>
                <strong>{careerClusterTotal}</strong>
                <span>nghề</span>
              </div>
            </div>
            <div className="summary-cluster-legend">
              {careerClusterSummary.map((item, index) => {
                const sharePercent =
                  careerClusterTotal > 0
                    ? Math.round((Number(item.count || 0) / careerClusterTotal) * 100)
                    : 0;
                const segmentColor =
                  CLUSTER_COLORS[index % CLUSTER_COLORS.length];

                return (
                  <article
                    className="summary-cluster-legend-item"
                    key={item.cluster}
                  >
                    <i style={{ backgroundColor: segmentColor }} />
                    <div className="summary-cluster-legend-copy">
                      <strong>{item.cluster}</strong>
                      <small>{sharePercent}% trong nhóm nổi bật</small>
                    </div>
                    <em>{item.count}</em>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="summary-empty-state">
            <p>Chưa có dữ liệu nhóm ngành từ danh sách nghề gợi ý.</p>
            <Link className="workflow-next-action" to="/discovery/recommendations">
              Xem gợi ý nghề
            </Link>
          </div>
        )}
      </section>

      <section className="card summary-dashboard-card">
        <div className="summary-section-heading">
          <div>
            <p className="summary-dashboard-eyebrow">Bar Chart xếp hạng</p>
            <h2>Top 10 yếu tố năng lực cốt lõi</h2>
          </div>
          <span>{coreScores.length} yếu tố đã chấm điểm</span>
        </div>

        {hasCoreScores ? (
          <>
            <div className="summary-core-legend">
              {Object.entries(CORE_TYPE_LABELS).map(([type, label]) => (
                <span key={type}>
                  <i style={{ backgroundColor: CORE_TYPE_COLORS[type] }} />
                  {label}
                </span>
              ))}
            </div>
            <TopElementsBarChart scores={coreScores} />
          </>
        ) : (
          <div className="summary-empty-state">
            <p>Chưa có kết quả Core Quiz để hiển thị top 10 yếu tố.</p>
            <Link className="workflow-next-action" to="/discovery/core-quiz">
              Làm Core Quiz
            </Link>
          </div>
        )}
      </section>

      <div className="summary-dashboard-actions">
        <Link className="recommendation-action secondary" to="/discovery/ai-discovery">
          Quay lại AI Discovery
        </Link>
        <Link className="recommendation-action" to="/discovery/recommendations">
          Xem gợi ý nghề
        </Link>
      </div>
    </div>
  );
}

export default DiscoverySummaryDashboard;
