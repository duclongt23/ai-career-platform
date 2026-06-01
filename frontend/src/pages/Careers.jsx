import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

const PAGE_SIZE = 12;

function Careers() {
  const [careers, setCareers] = useState([]);
  const [search, setSearch] = useState("");
  const [field, setField] = useState("");
  const [filters, setFilters] = useState({ search: "", field: "" });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCareers = useCallback(async (page, currentFilters) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/careers", {
        params: {
          ...currentFilters,
          page,
          limit: PAGE_SIZE,
        },
      });

      setCareers(response.data.careers || []);
      setPagination(response.data.pagination);
    } catch (requestError) {
      console.error("Lỗi tải ngành nghề", requestError);
      setError("Không thể tải danh sách nghề nghiệp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    api
      .get("/careers", {
        params: {
          page: 1,
          limit: PAGE_SIZE,
        },
      })
      .then((response) => {
        if (!ignore) {
          setCareers(response.data.careers || []);
          setPagination(response.data.pagination);
        }
      })
      .catch((requestError) => {
        console.error("Lỗi tải ngành nghề", requestError);

        if (!ignore) {
          setError("Không thể tải danh sách nghề nghiệp. Vui lòng thử lại.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    const nextFilters = {
      search: search.trim(),
      field: field.trim(),
    };

    setFilters(nextFilters);
    fetchCareers(1, nextFilters);
  };

  const handlePageChange = (page) => {
    fetchCareers(page, filters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Danh sách ngành nghề</h1>
        <p>Khám phá thông tin cơ bản về các nghề nghiệp phù hợp với học sinh cấp 3.</p>
      </div>

      <form className="filter-box" onSubmit={handleSearch}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo tên hoặc mô tả nghề..."
        />

        <input
          value={field}
          onChange={(event) => setField(event.target.value)}
          placeholder="Lĩnh vực, ví dụ: Công nghệ"
        />

        <button>Tìm kiếm</button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : careers.length === 0 ? (
        <p>Không tìm thấy nghề nghiệp phù hợp với bộ lọc.</p>
      ) : (
        <>
          <p className="career-count">{pagination.total} nghề nghiệp</p>

          <div className="career-grid">
            {careers.map((career) => (
              <article className="card career-card" key={career._id}>
                <h2>{career.title_vi || career.title_en}</h2>

                <p className="career-description">
                  {career.description_vi || "Đang cập nhật mô tả nghề nghiệp."}
                </p>

                <Link className="detail-link" to={`/careers/${career._id}`}>
                  Xem chi tiết
                </Link>
              </article>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <nav className="career-pagination" aria-label="Phân trang nghề nghiệp">
              <button
                className="secondary-button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Trang trước
              </button>
              <span>
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                className="secondary-button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Trang sau
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default Careers;
