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
  const maxClusterCount = Math.max(
    ...careerClusterSummary.map((item) => item.count),
    1
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
            {developmentAreas.map((area, index) => (
              <article className="summary-growth-card" key={area.code}>
                <div className="summary-growth-card-heading">
                  <span>Ưu tiên #{index + 1}</span>
                  <strong>{getSummaryElementName(area)}</strong>
                </div>
                <p>
                  Nên rèn luyện yếu tố này vì nó xuất hiện trong {area.count}{" "}
                  nghề gợi ý và có ảnh hưởng rõ tới mức độ sẵn sàng cho các
                  hướng nghề liên quan.
                </p>
                {area.careerTitles.length > 0 && (
                  <small>
                    Gặp trong: {area.careerTitles.join(", ")}
                  </small>
                )}
              </article>
            ))}
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
            <h2>Biểu đồ nhóm năng lực dễ đọc</h2>
          </div>
          <span>{competencyGroups.length} nhóm</span>
        </div>

        {hasCoreScores ? (
          <div className="summary-competency-list">
            {competencyGroups.map((group) => (
              <article className="summary-competency-row" key={group.id}>
                <div className="summary-competency-copy">
                  <strong>{group.label}</strong>
                  <span>{group.description}</span>
                  {group.matchedElements.length > 0 && (
                    <small>
                      Dựa trên:{" "}
                      {group.matchedElements
                        .map((element) => getSummaryElementName(element))
                        .join(", ")}
                    </small>
                  )}
                </div>
                <div className="summary-competency-track">
                  <div
                    style={{
                      width:
                        group.score == null
                          ? "0%"
                          : `${Math.max(Math.round(group.score * 100), 8)}%`,
                    }}
                  />
                </div>
                <span className="summary-competency-score">{group.scoreLabel}</span>
              </article>
            ))}
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
          <div className="summary-cluster-chart" aria-label="Biểu đồ nhóm ngành nổi bật">
            {careerClusterSummary.map((item, index) => (
              <article className="summary-cluster-row" key={item.cluster}>
                <span className="summary-cluster-rank">#{index + 1}</span>
                <div className="summary-cluster-name">
                  <strong>{item.cluster}</strong>
                  <small>{item.count} nghề gợi ý</small>
                </div>
                <div className="summary-cluster-track">
                  <div
                    className="summary-cluster-fill"
                    style={{ width: `${Math.max((item.count / maxClusterCount) * 100, 8)}%` }}
                  />
                </div>
                <em>{item.count}</em>
              </article>
            ))}
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
            <p className="summary-dashboard-eyebrow">Horizontal Bar Chart</p>
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
