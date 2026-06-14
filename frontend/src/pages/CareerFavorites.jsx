import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { normalizeCareerClusters } from "../utils/careerCluster";

function CareerFavorites() {
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchFavorites() {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/careers/favorites/me");

        if (isMounted) {
          setCareers(res.data.careers || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.message ||
              "Không tải được danh sách nghề yêu thích."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchFavorites();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRemove = async (careerId) => {
    setRemovingId(careerId);
    setError("");
    setMessage("");

    try {
      await api.delete(`/careers/${careerId}/favorite`);
      setCareers((current) =>
        current.filter((career) => career._id !== careerId)
      );
      setMessage("Đã bỏ nghề khỏi danh sách yêu thích.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không thể bỏ lưu nghề này. Vui lòng thử lại."
      );
    } finally {
      setRemovingId("");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Nghề yêu thích</h1>
        <p>
          Danh sách các nghề bạn đã lưu để xem lại, so sánh và tiếp tục khám
          phá khi cần.
        </p>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {loading ? (
        <section className="card">
          <p className="muted">Đang tải danh sách nghề yêu thích...</p>
        </section>
      ) : careers.length === 0 ? (
        <section className="card favorite-empty-state">
          <h2>Chưa có nghề yêu thích</h2>
          <p className="muted">
            Hãy mở chi tiết một nghề phù hợp rồi lưu lại để theo dõi sau.
          </p>
          <Link className="detail-link" to="/discovery/recommendations">
            Xem nghề gợi ý
          </Link>
        </section>
      ) : (
        <section className="career-grid">
          {careers.map((career) => {
            const title = career.title_vi || career.title_en;
            const clusters = normalizeCareerClusters(career.careerCluster);

            return (
              <article className="card career-card favorite-career-card" key={career._id}>
                <div className="profile-tags">
                  {clusters.slice(0, 3).map((cluster) => (
                    <span key={cluster}>{cluster}</span>
                  ))}
                </div>

                <h2>{title}</h2>
                {career.title_vi && <p className="muted">{career.title_en}</p>}
                <p className="career-description">
                  {career.description_vi || "Đang cập nhật mô tả nghề nghiệp."}
                </p>

                <div className="form-actions">
                  <Link className="detail-link" to={`/careers/${career._id}`}>
                    Xem chi tiết
                  </Link>
                  <Link
                    className="detail-link secondary"
                    to={`/careers/${career._id}/explore-chat`}
                  >
                    Hỏi AI
                  </Link>
                  <button
                    className="secondary"
                    disabled={removingId === career._id}
                    onClick={() => handleRemove(career._id)}
                    type="button"
                  >
                    {removingId === career._id ? "Đang bỏ lưu..." : "Bỏ lưu"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default CareerFavorites;
