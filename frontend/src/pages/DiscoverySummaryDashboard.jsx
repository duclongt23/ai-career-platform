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

function DiscoverySummaryDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [profile, setProfile] = useState(null);
  const [coreResult, setCoreResult] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login", {
        state: {
          message: "Yeu cau dang nhap de xem dashboard tong ket",
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
      .then(([profileResponse, coreResponse, recommendationsResponse, questionsResponse]) => {
        if (!isMounted) return;

        if (profileResponse.status === "fulfilled") {
          setProfile(profileResponse.value.data);
        } else {
          setError("Khong tai duoc ho so tong ket. Vui long thu lai sau.");
        }

        if (coreResponse.status === "fulfilled") {
          setCoreResult(coreResponse.value.data);
        }

        if (recommendationsResponse.status === "fulfilled") {
          setRecommendations(recommendationsResponse.value.data.recommendations || []);
        }

        if (questionsResponse.status === "fulfilled") {
          setQuestions(questionsResponse.value.data || []);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
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

  if (isLoading) {
    return (
      <section className="card summary-dashboard-card">
        <p className="muted">Dang tai dashboard tong ket...</p>
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
        <p className="summary-dashboard-eyebrow">Tong ket ho so</p>
        <h1>Nhìn lại hồ sơ khám phá bản thân trước khi xem nghề</h1>
        <p>
          Dashboard gom hai lớp dữ liệu quan trọng: sở thích Holland Code và
          các yếu tố năng lực cốt lõi có điểm cao nhất.
        </p>
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
          <div className="summary-cluster-list">
            {careerClusterSummary.map((item, index) => (
              <article key={item.cluster}>
                <div>
                  <span>Top {index + 1}</span>
                  <strong>{item.cluster}</strong>
                </div>
                <em>{item.count} nghề</em>
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
            <p>Chua co diem RIASEC de hien thi radar.</p>
            <Link className="workflow-next-action" to="/discovery/riasec">
              Lam bai RIASEC
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
            <p>Chua co ket qua Core Quiz de hien thi top 10 yeu to.</p>
            <Link className="workflow-next-action" to="/discovery/core-quiz">
              Lam Core Quiz
            </Link>
          </div>
        )}
      </section>

      <div className="summary-dashboard-actions">
        <Link className="recommendation-action secondary" to="/discovery/ai-discovery">
          Quay lai AI Discovery
        </Link>
        <Link className="recommendation-action" to="/discovery/recommendations">
          Xem goi y nghe
        </Link>
      </div>
    </div>
  );
}

export default DiscoverySummaryDashboard;
