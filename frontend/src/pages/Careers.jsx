import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

function Careers() {
  const [careers, setCareers] = useState([]);
  const [search, setSearch] = useState("");
  const [field, setField] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCareers();
  }, []);

  const fetchCareers = async () => {
    setLoading(true);

    try {
      const res = await api.get("/careers", {
        params: {
          search,
          field,
        },
      });

      setCareers(res.data);
    } catch (err) {
      console.error("Lỗi tải ngành nghề", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCareers();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Danh sách ngành nghề</h1>
        <p>Khám phá các ngành học và nghề nghiệp phù hợp với học sinh cấp 3.</p>
      </div>

      <form className="filter-box" onSubmit={handleSearch}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm ngành nghề..."
        />

        <input
          value={field}
          onChange={(e) => setField(e.target.value)}
          placeholder="Lĩnh vực, ví dụ: Công nghệ"
        />

        <button>Tìm kiếm</button>
      </form>

      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : careers.length === 0 ? (
        <p>Chưa có ngành nghề nào. Hãy thêm dữ liệu từ backend/Postman.</p>
      ) : (
        <div className="career-grid">
          {careers.map((career) => (
            <div className="card career-card" key={career._id}>
              <span className="tag">{career.field}</span>

              <h2>{career.name}</h2>

              <p>{career.description}</p>

              <div>
                <strong>Môn liên quan:</strong>
                <p>{career.requiredSubjects?.join(", ")}</p>
              </div>

              <div>
                <strong>Kỹ năng cần có:</strong>
                <p>{career.requiredSkills?.join(", ")}</p>
              </div>

              <Link className="detail-link" to={`/careers/${career._id}`}>
                Xem chi tiết
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Careers;