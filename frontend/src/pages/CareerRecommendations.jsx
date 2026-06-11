import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { DEFAULT_RECOMMENDATION_LIMIT } from "../constants/recommendations";
import { normalizeCareerClusters } from "../utils/careerCluster";

const NODE_LAYOUT = [
  { top: 16, left: 43, size: "lg", placement: "down" },
  { top: 27, left: 57, size: "lg", placement: "down" },
  { top: 42, left: 45, size: "lg", placement: "down" },
  { top: 53, left: 58, size: "lg", placement: "up" },
  { top: 34, left: 33, size: "lg", placement: "down" },
  { top: 18, left: 24, size: "md", placement: "down" },
  { top: 19, left: 72, size: "md", placement: "down-left" },
  { top: 34, left: 16, size: "md", placement: "down" },
  { top: 36, left: 82, size: "md", placement: "down-left" },
  { top: 52, left: 23, size: "md", placement: "up" },
  { top: 51, left: 76, size: "md", placement: "up-left" },
  { top: 68, left: 35, size: "md", placement: "up" },
  { top: 69, left: 63, size: "md", placement: "up" },
  { top: 81, left: 47, size: "md", placement: "up" },
  { top: 82, left: 75, size: "md", placement: "up-left" },
  { top: 12, left: 9, size: "sm", placement: "down" },
  { top: 10, left: 91, size: "sm", placement: "down-left" },
  { top: 27, left: 7, size: "sm", placement: "down" },
  { top: 28, left: 93, size: "sm", placement: "down-left" },
  { top: 47, left: 8, size: "sm", placement: "up" },
  { top: 47, left: 93, size: "sm", placement: "up-left" },
  { top: 66, left: 10, size: "sm", placement: "up" },
  { top: 66, left: 90, size: "sm", placement: "up-left" },
  { top: 86, left: 15, size: "sm", placement: "up" },
  { top: 89, left: 88, size: "sm", placement: "up-left" },
];

function formatElementCode(code) {
  return String(code || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getMatchScore(career) {
  if (Number.isFinite(career.matchPercentage)) {
    return Math.round(career.matchPercentage);
  }

  if (Number.isFinite(career.recommendationScore)) {
    return Math.round(
      career.recommendationScore <= 1
        ? career.recommendationScore * 100
        : career.recommendationScore
    );
  }

  return null;
}

function getTier(index) {
  if (index < 5) {
    return "tier-best";
  }

  if (index < 15) {
    return "tier-strong";
  }

  return "tier-explore";
}

function RecommendationNode({ career, index }) {
  const title = career.title_vi || career.title_en;
  const clusters = normalizeCareerClusters(career.careerCluster).slice(0, 2);
  const matchedElements = career.topMatchedElements?.slice(0, 3) || [];
  const matchScore = getMatchScore(career);
  const layout = NODE_LAYOUT[index] || NODE_LAYOUT[NODE_LAYOUT.length - 1];
  const tier = getTier(index);

  return (
    <article
      className={`recommendation-node ${tier} node-${layout.size} popover-${layout.placement}`}
      style={{ "--node-left": `${layout.left}%`, "--node-top": `${layout.top}%` }}
    >
      <Link className="recommendation-node-link" to={`/careers/${career._id}`}>
        <span className="recommendation-node-dot" aria-hidden="true" />
        <span className="recommendation-node-copy">
          <span className="recommendation-rank">#{index + 1}</span>
          <span className="recommendation-title">{title}</span>
          {matchScore !== null && (
            <span className="recommendation-score">{matchScore}% match</span>
          )}
        </span>
      </Link>

      <div className="recommendation-popover">
        <div className="recommendation-card-title">
          <div className="recommendation-tag-row">
            {clusters.map((cluster) => (
              <span className="tag" key={cluster}>
                {cluster}
              </span>
            ))}
          </div>
          <h2>{title}</h2>
          {career.title_vi && <p className="muted">{career.title_en}</p>}
        </div>

        <p className="recommendation-description">
          {career.description_vi || "Đang cập nhật mô tả nghề nghiệp."}
        </p>

        {matchedElements.length > 0 && (
          <div className="recommendation-matches">
            <strong>Điểm mạnh phù hợp</strong>
            <div>
              {matchedElements.map((element) => (
                <span key={element.code}>{formatElementCode(element.code)}</span>
              ))}
            </div>
          </div>
        )}

        <div className="recommendation-card-actions">
          <Link className="detail-link" to={`/careers/${career._id}`}>
            Khám phá nghề này
          </Link>
          <Link
            className="detail-link secondary"
            to={`/careers/${career._id}/explore-chat`}
          >
            Hỏi AI
          </Link>
        </div>
      </div>
    </article>
  );
}

function CareerRecommendations() {
  const token = localStorage.getItem("token");
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [needsProfiling, setNeedsProfiling] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;

    api
      .get("/careers/recommendations/me")
      .then((response) => {
        if (!ignore) {
          setRecommendations(response.data.recommendations || []);
        }
      })
      .catch((requestError) => {
        if (ignore) {
          return;
        }

        if (requestError.response?.status === 409) {
          setNeedsProfiling(true);
          return;
        }

        setError(
          requestError.response?.data?.message ||
            "Không thể tải gợi ý nghề nghiệp. Vui lòng thử lại."
        );
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  if (!token) {
    return (
      <section className="recommendation-empty card">
        <h1>Gợi ý nghề nghiệp dành riêng cho bạn</h1>
        <p>Đăng nhập để xem các nghề phù hợp nhất với hồ sơ cá nhân.</p>
        <Link
          className="recommendation-action"
          to="/login"
          state={{ from: "/discovery/recommendations" }}
        >
          Đăng nhập để tiếp tục
        </Link>
      </section>
    );
  }

  return (
    <div className="recommendation-page">
      <header className="recommendation-hero">
        <h1>Nghề nghiệp gợi ý cho bạn</h1>
        <p>
          Các nghề được đặt theo mức độ phù hợp. Node lớn và nổi hơn là nhóm nên
          ưu tiên xem trước, các node nhỏ hơn là hướng mở rộng để so sánh.
        </p>
      </header>

      {loading && <p className="recommendation-status">Đang phân tích hồ sơ...</p>}

      {error && <p className="error">{error}</p>}

      {needsProfiling && (
        <section className="recommendation-empty card">
          <h2>Hồ sơ chưa đủ dữ liệu để gợi ý</h2>
          <p>
            Hoàn thành bài khám phá bản thân hoặc AI Discovery để hệ thống hiểu
            rõ hơn về bạn.
          </p>
          <div className="recommendation-actions">
            <Link className="recommendation-action" to="/discovery/core-quiz">
              Làm bài khám phá bản thân
            </Link>
            <Link className="recommendation-action secondary" to="/discovery/ai-discovery">
              Trò chuyện với AI
            </Link>
          </div>
        </section>
      )}

      {!loading && !error && !needsProfiling && recommendations.length === 0 && (
        <section className="recommendation-empty card">
          <h2>Chưa tìm thấy nghề phù hợp</h2>
          <p>Hãy bổ sung thêm thông tin trong hồ sơ để nhận kết quả tốt hơn.</p>
        </section>
      )}

      {recommendations.length > 0 && (
        <>
          <div className="recommendation-summary">
            <strong>{recommendations.length} nghề được đề xuất</strong>
            <span>Hover vào từng node để xem thông tin nhanh</span>
          </div>

          <section className="recommendation-map" aria-label="Bản đồ nghề nghiệp gợi ý">
            <div className="recommendation-map-legend" aria-label="Phân tầng gợi ý">
              <span><i className="tier-best" /> Best Matches</span>
              <span><i className="tier-strong" /> Strong Recommendations</span>
              <span><i className="tier-explore" /> Explore More</span>
            </div>

            {recommendations.slice(0, DEFAULT_RECOMMENDATION_LIMIT).map((career, index) => (
              <RecommendationNode career={career} index={index} key={career._id} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export default CareerRecommendations;
