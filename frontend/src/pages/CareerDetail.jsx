import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";

function CareerDetail() {
  const { id } = useParams();

  const [career, setCareer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCareerDetail();
  }, [id]);

  const fetchCareerDetail = async () => {
    try {
      const res = await api.get(`/careers/${id}`);
      setCareer(res.data);
    } catch (err) {
      console.error("Lỗi tải chi tiết ngành", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p>Đang tải chi tiết...</p>;
  }

  if (!career) {
    return <p>Không tìm thấy ngành nghề.</p>;
  }

  return (
    <div className="card detail-card">
      <Link to="/careers">← Quay lại danh sách</Link>

      <h1>{career.name}</h1>

      <span className="tag">{career.field}</span>

      <p>{career.description}</p>

      <section>
        <h3>Môn học liên quan</h3>
        <ul>
          {career.requiredSubjects.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Kỹ năng cần có</h3>
        <ul>
          {career.requiredSkills.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Sở thích phù hợp</h3>
        <ul>
          {career.suitableInterests.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Roadmap cơ bản</h3>
        <ol>
          {career.roadmap.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default CareerDetail;