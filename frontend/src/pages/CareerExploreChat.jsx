import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { CareerExploreChatSection } from "./CareerDetail";

function CareerExploreChat() {
  const { id } = useParams();
  const [career, setCareer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/careers/${id}`)
      .then((response) => setCareer(response.data))
      .catch(() => setCareer(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p>Đang tải thông tin nghề nghiệp...</p>;
  }

  if (!career) {
    return <p>Không tìm thấy nghề nghiệp.</p>;
  }

  const title = career.title_vi || career.name || career.title_en;

  return (
    <div className="career-explore-chat-page">
      <Link className="career-explore-chat-back" to={`/careers/${id}`}>
        ← Quay lại chi tiết nghề
      </Link>
      <CareerExploreChatSection careerId={id} key={id} title={title} />
    </div>
  );
}

export default CareerExploreChat;
