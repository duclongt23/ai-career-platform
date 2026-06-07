import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import IndustryDonutChart from "../components/analytics/IndustryDonutChart";

function formatElementCode(code) {
  return String(code || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
        <span className="recommendation-eyebrow">Gợi ý cá nhân hóa</span>
        <h1>15 nghề nghiệp phù hợp với bạn</h1>
        <p>
          Kết quả được xếp hạng từ những năng lực, kỹ năng và phong cách làm
          việc bạn đã xác nhận. Hãy dùng danh sách này làm điểm bắt đầu để khám
          phá sâu hơn.
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
          <IndustryDonutChart recommendations={recommendations} />

          <div className="recommendation-summary">
            <strong>{recommendations.length} nghề được đề xuất</strong>
          </div>

          <div className="recommendation-grid">
            {recommendations.map((career, index) => (
              <article className="card recommendation-card" key={career._id}>
                <div className="recommendation-card-top">
                  <span className="recommendation-rank">#{index + 1}</span>
                </div>

                <div className="recommendation-card-title">
                  {career.careerCluster && (
                    <span className="tag">{career.careerCluster}</span>
                  )}
                  <h2>{career.title_vi || career.title_en}</h2>
                  {career.title_vi && <p className="muted">{career.title_en}</p>}
                </div>

                <p className="recommendation-description">
                  {career.description_vi || "Đang cập nhật mô tả nghề nghiệp."}
                </p>

                {career.topMatchedElements?.length > 0 && (
                  <div className="recommendation-matches">
                    <strong>Điểm mạnh phù hợp</strong>
                    <div>
                      {career.topMatchedElements.map((element) => (
                        <span key={element.code}>
                          {formatElementCode(element.code)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Link className="detail-link" to={`/careers/${career._id}`}>
                  Khám phá nghề này
                </Link>
                <Link className="detail-link" to={`/careers/${career._id}/explore-chat`}>
                  Hỏi AI về nghề này
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default CareerRecommendations;
