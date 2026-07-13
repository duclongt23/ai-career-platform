import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { DEFAULT_RECOMMENDATION_LIMIT } from "../constants/recommendations";
import { normalizeCareerClusters } from "../utils/careerCluster";

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 720;
const NODE_ANCHORS = [
  { top: 45, left: 50, size: "hero", placement: "down" },
  { top: 23, left: 34, size: "lg", placement: "down" },
  { top: 24, left: 66, size: "lg", placement: "down-left" },
  { top: 62, left: 32, size: "lg", placement: "up" },
  { top: 62, left: 68, size: "lg", placement: "up-left" },
  { top: 38, left: 18, size: "md", placement: "down" },
  { top: 38, left: 82, size: "md", placement: "down-left" },
  { top: 15, left: 50, size: "md", placement: "down" },
  { top: 78, left: 50, size: "md", placement: "up" },
  { top: 74, left: 17, size: "md", placement: "up" },
  { top: 74, left: 83, size: "md", placement: "up-left" },
  { top: 14, left: 15, size: "sm", placement: "down" },
  { top: 14, left: 85, size: "sm", placement: "down-left" },
  { top: 86, left: 31, size: "sm", placement: "up" },
  { top: 86, left: 69, size: "sm", placement: "up-left" },
  { top: 52, left: 8, size: "sm", placement: "up" },
  { top: 52, left: 92, size: "sm", placement: "up-left" },
  { top: 28, left: 8, size: "sm", placement: "down" },
  { top: 28, left: 92, size: "sm", placement: "down-left" },
  { top: 88, left: 9, size: "sm", placement: "up" },
  { top: 88, left: 91, size: "sm", placement: "up-left" },
  { top: 8, left: 31, size: "sm", placement: "down" },
  { top: 8, left: 69, size: "sm", placement: "down-left" },
  { top: 93, left: 43, size: "sm", placement: "up" },
  { top: 93, left: 57, size: "sm", placement: "up-left" },
];
const NODE_BOUNDS = {
  hero: { width: 235, height: 82 },
  lg: { width: 190, height: 58 },
  md: { width: 158, height: 50 },
  sm: { width: 118, height: 42 },
};
const INITIAL_RANK_TABLE_LIMIT = 15;

function formatElementCode(code) {
  return String(code || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getElementDisplayName(element) {
  return (
    element?.name_vi ||
    element?.name_en ||
    element?.name ||
    formatElementCode(element?.code)
  );
}

function getMatchScore(career) {
  if (Number.isFinite(career.displayMatchScore)) {
    return Math.round(career.displayMatchScore);
  }

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

function getCareerTitle(career) {
  return career.title_vi || career.title_en || "Career";
}

function getCompactCareerTitle(title, size) {
  const firstPhrase = String(title || "").split(/[,(]/)[0].trim();
  const preferredTitle =
    firstPhrase.length >= 10 && firstPhrase.length <= 34 ? firstPhrase : title;
  const maxLength = size === "hero" ? 42 : size === "lg" ? 34 : 28;
  const normalizedTitle = String(preferredTitle || "").replace(/\s+/g, " ").trim();

  if (normalizedTitle.length <= maxLength) {
    return normalizedTitle;
  }

  return `${normalizedTitle.slice(0, maxLength - 1).trim()}...`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getNodeRadius(size) {
  const bounds = NODE_BOUNDS[size] || NODE_BOUNDS.md;

  return Math.max(bounds.width, bounds.height) / 2;
}

function getCareerClusters(career) {
  return normalizeCareerClusters(career.careerCluster);
}

function doClustersOverlap(firstClusters, secondClusters) {
  return firstClusters.some((cluster) => secondClusters.includes(cluster));
}

function buildRecommendationMapNodes(recommendations) {
  const nodes = recommendations.map((career, index) => {
    const anchor = NODE_ANCHORS[index] || NODE_ANCHORS[NODE_ANCHORS.length - 1];

    return {
      career,
      clusters: getCareerClusters(career),
      index,
      placement: anchor.placement,
      size: anchor.size,
      x: (anchor.left / 100) * MAP_WIDTH,
      y: (anchor.top / 100) * MAP_HEIGHT,
    };
  });

  for (let iteration = 0; iteration < 10; iteration += 1) {
    for (let currentIndex = 0; currentIndex < nodes.length; currentIndex += 1) {
      for (let nextIndex = currentIndex + 1; nextIndex < nodes.length; nextIndex += 1) {
        const current = nodes[currentIndex];
        const next = nodes[nextIndex];
        let deltaX = next.x - current.x;
        let deltaY = next.y - current.y;
        let distance = Math.hypot(deltaX, deltaY);

        if (distance === 0) {
          deltaX = 1;
          deltaY = 1;
          distance = Math.hypot(deltaX, deltaY);
        }

        const minimumDistance =
          getNodeRadius(current.size) + getNodeRadius(next.size) + 36;

        if (distance >= minimumDistance) {
          continue;
        }

        const force = (minimumDistance - distance) / distance / 2;
        const offsetX = deltaX * force;
        const offsetY = deltaY * force;

        if (current.index !== 0) {
          current.x -= offsetX;
          current.y -= offsetY;
        }

        if (next.index !== 0) {
          next.x += offsetX;
          next.y += offsetY;
        }
      }
    }

    nodes.forEach((node) => {
      const bounds = NODE_BOUNDS[node.size] || NODE_BOUNDS.md;

      node.x = clamp(
        node.x,
        bounds.width / 2 + 14,
        MAP_WIDTH - bounds.width / 2 - 14
      );
      node.y = clamp(
        node.y,
        bounds.height / 2 + 18,
        MAP_HEIGHT - bounds.height / 2 - 18
      );
    });
  }

  return nodes.map((node) => ({
    ...node,
    left: (node.x / MAP_WIDTH) * 100,
    top: (node.y / MAP_HEIGHT) * 100,
  }));
}

function buildRecommendationConnections(nodes) {
  const connections = [];

  nodes.slice(1, 14).forEach((node) => {
    if (!node.clusters.length) {
      return;
    }

    const relatedNode = nodes
      .slice(0, node.index)
      .find((candidate) =>
        candidate.clusters.length &&
        doClustersOverlap(candidate.clusters, node.clusters)
      );

    if (!relatedNode) {
      return;
    }

    const curveOffset = Math.min(68, Math.abs(node.x - relatedNode.x) * 0.18 + 22);
    const midX = (relatedNode.x + node.x) / 2;
    const midY = (relatedNode.y + node.y) / 2 - curveOffset;

    connections.push({
      d: `M ${relatedNode.x.toFixed(1)} ${relatedNode.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${node.x.toFixed(1)} ${node.y.toFixed(1)}`,
      id: `${relatedNode.index}-${node.index}`,
      isPrimary: relatedNode.index === 0,
    });
  });

  return connections.slice(0, 8);
}

function RecommendationNode({ node }) {
  const { career, index, placement, size } = node;
  const title = getCareerTitle(career);
  const compactTitle = getCompactCareerTitle(title, size);
  const clusters = normalizeCareerClusters(career.careerCluster).slice(0, 2);
  const matchedElements = career.topMatchedElements?.slice(0, 3) || [];
  const tier = getTier(index);
  const matchScore = getMatchScore(career);

  return (
    <article
      className={`recommendation-node ${tier} node-${size} popover-${placement}`}
      style={{ "--node-left": `${node.left}%`, "--node-top": `${node.top}%` }}
    >
      <Link
        aria-label={title}
        className="recommendation-node-link"
        title={title}
        to={`/careers/${career._id}`}
      >
        <span className="recommendation-node-rank">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="recommendation-node-dot" aria-hidden="true" />
        <span className="recommendation-node-copy">
          <span className="recommendation-title">{compactTitle}</span>
          {matchScore !== null && (
            <span className="recommendation-score">{matchScore}%</span>
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
                <span key={element.code}>{getElementDisplayName(element)}</span>
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

function RecommendationRankTable({ recommendations = [] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleRecommendations = showAll
    ? recommendations
    : recommendations.slice(0, INITIAL_RANK_TABLE_LIMIT);
  const canToggleMore = recommendations.length > INITIAL_RANK_TABLE_LIMIT;

  return (
    <section
      className="recommendation-rank-table-section"
      aria-labelledby="recommendation-rank-table-title"
    >
      <div className="recommendation-rank-table-heading">
        <div>
          <span className="recommendation-eyebrow">Bảng xếp hạng</span>
          <h2 id="recommendation-rank-table-title">Danh sách nghề gợi ý theo mức độ phù hợp</h2>
        </div>
        <span>{visibleRecommendations.length}/{recommendations.length} nghề</span>
      </div>

      <div className="recommendation-rank-table-wrap">
        <table className="recommendation-rank-table">
          <colgroup>
            <col className="recommendation-rank-col" />
            <col className="recommendation-career-col" />
            <col className="recommendation-cluster-col" />
            <col className="recommendation-score-col" />
            <col className="recommendation-action-col" />
          </colgroup>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Nghề gợi ý</th>
              <th>Nhóm nghề</th>
              <th>
                <span className="recommendation-score-header">
                  Điểm phù hợp
                  <button
                    type="button"
                    className="recommendation-score-info"
                    aria-label="Giải thích điểm phù hợp"
                  >
                    !
                    <span role="tooltip">
                      Mức độ phù hợp chỉ mang tính tham khảo tương đối, giúp học
                      sinh có thêm góc nhìn khi định hướng nghề nghiệp. Con số
                      này không đồng nghĩa với xác suất thành công trong nghề.
                    </span>
                  </button>
                </span>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleRecommendations.map((career, index) => {
              const title = career.title_vi || career.title_en;
              const clusters = normalizeCareerClusters(career.careerCluster);
              const matchScore = getMatchScore(career);

              return (
                <tr key={career._id || `${career.onetCode}-${index}`}>
                  <td>
                    <span className={`recommendation-table-rank ${getTier(index)}`}>
                      #{index + 1}
                    </span>
                  </td>
                  <td>
                    <Link className="recommendation-table-title" to={`/careers/${career._id}`}>
                      {title}
                    </Link>
                    {career.title_vi && (
                      <span className="recommendation-table-subtitle">{career.title_en}</span>
                    )}
                  </td>
                  <td>
                    <div className="recommendation-table-tags">
                      {(clusters.length ? clusters : ["Chưa phân nhóm"])
                        .slice(0, 2)
                        .map((cluster) => (
                          <span className="tag" key={cluster}>
                            {cluster}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td>
                    <div className="recommendation-table-score">
                      <strong>{matchScore !== null ? `${matchScore}%` : "-"}</strong>
                      <span>phù hợp</span>
                    </div>
                  </td>
                  <td>
                    <Link className="recommendation-table-action" to={`/careers/${career._id}`}>
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canToggleMore && (
        <div className="recommendation-rank-table-footer">
          <button type="button" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Thu gọn" : `Xem thêm ${recommendations.length - INITIAL_RANK_TABLE_LIMIT} nghề`}
          </button>
        </div>
      )}
    </section>
  );
}

function CareerRecommendations() {
  const token = localStorage.getItem("token");
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [needsProfiling, setNeedsProfiling] = useState(false);
  const [viewMode, setViewMode] = useState("node");
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleViewportChange = () => {
      const nextIsMobile = mediaQuery.matches;

      setIsMobileView(nextIsMobile);

      if (nextIsMobile) {
        setViewMode("table");
      }
    };

    handleViewportChange();
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

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

  const visibleMapRecommendations = useMemo(
    () => recommendations.slice(0, DEFAULT_RECOMMENDATION_LIMIT),
    [recommendations]
  );
  const recommendationMapNodes = useMemo(
    () => buildRecommendationMapNodes(visibleMapRecommendations),
    [visibleMapRecommendations]
  );
  const recommendationConnections = useMemo(
    () => buildRecommendationConnections(recommendationMapNodes),
    [recommendationMapNodes]
  );

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

  const effectiveViewMode = isMobileView ? "table" : viewMode;

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
            <div>
              <strong>{recommendations.length} nghề được đề xuất</strong>
              <span>
                {effectiveViewMode === "node"
                  ? "Hover vào từng node để xem thông tin nhanh"
                  : "Bảng rank giữ nguyên thứ tự và điểm phù hợp từ hệ thống"}
              </span>
            </div>

            {!isMobileView && (
            <div className="recommendation-view-toggle" aria-label="Chọn kiểu hiển thị gợi ý">
              <button
                className={viewMode === "node" ? "active" : ""}
                type="button"
                aria-pressed={viewMode === "node"}
                onClick={() => setViewMode("node")}
              >
                Sơ đồ
              </button>
              <button
                className={viewMode === "table" ? "active" : ""}
                type="button"
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
              >
                Bảng xếp hạng
              </button>
            </div>
            )}
          </div>

          {effectiveViewMode === "table" ? (
            <RecommendationRankTable recommendations={recommendations} />
          ) : (
            <section className="recommendation-map" aria-label="Bản đồ nghề nghiệp gợi ý">
              {recommendationConnections.length > 0 && (
                <svg
                  className="recommendation-map-connections"
                  aria-hidden="true"
                  viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  {recommendationConnections.map((connection) => (
                    <path
                      className={connection.isPrimary ? "is-primary" : ""}
                      d={connection.d}
                      key={connection.id}
                    />
                  ))}
                </svg>
              )}

              <div className="recommendation-map-legend" aria-label="Phân tầng gợi ý">
                <span><i className="tier-best" /> Phù hợp nhất</span>
                <span><i className="tier-strong" /> Gợi ý mạnh</span>
                <span><i className="tier-explore" /> Khám phá thêm</span>
              </div>

              {recommendationMapNodes.map((node) => (
                <RecommendationNode
                  key={node.career._id || `${node.career.onetCode}-${node.index}`}
                  node={node}
                />
              ))}
            </section>
          )}

          <section className="recommendation-disclaimer" aria-label="Luu y ve ket qua goi y">
            <strong>Lưu ý:</strong>{" "}
            <span>
              Kết quả gợi ý chỉ mang tính chất tham khảo, được xây dựng dựa trên
              hồ sơ hiện tại của học sinh và dữ liệu nghề nghiệp. Hệ thống không
              thay thế tư vấn của giáo viên, phụ huynh hoặc chuyên gia hướng nghiệp.
            </span>
          </section>
        </>
      )}
    </div>
  );
}

export default CareerRecommendations;
