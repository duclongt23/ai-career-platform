import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import { CareerExploreChatSection } from "./CareerDetail";

function formatUpdatedAt(value) {
  if (!value) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function CareerExploreChats() {
  const token = localStorage.getItem("token");
  const { id } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [career, setCareer] = useState(null);
  const [loadingChats, setLoadingChats] = useState(Boolean(token));
  const [loadingCareer, setLoadingCareer] = useState(Boolean(id));
  const [error, setError] = useState("");

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.careerId === id),
    [chats, id]
  );

  const loadChats = useCallback(() => {
    if (!token) {
      return Promise.resolve();
    }

    setLoadingChats(true);
    setError("");

    return api
      .get("/careers/explore-chats/me")
      .then((response) => {
        const nextChats = response.data?.chats || [];

        setChats(nextChats);

        if (!id && nextChats.length > 0) {
          navigate(`/career-explore-chats/${nextChats[0].careerId}`, {
            replace: true,
          });
        }
      })
      .catch((requestError) => {
        setError(
          requestError.response?.data?.message ||
            "Không thể tải danh sách hội thoại. Vui lòng thử lại."
        );
      })
      .finally(() => setLoadingChats(false));
  }, [id, navigate, token]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!id) {
      setCareer(null);
      setLoadingCareer(false);
      return undefined;
    }

    let ignore = false;

    setLoadingCareer(true);
    api
      .get(`/careers/${id}`)
      .then((response) => {
        if (!ignore) {
          setCareer(response.data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setCareer(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingCareer(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: "/career-explore-chats" }} />;
  }

  const title = career?.title_vi || career?.name || career?.title_en;

  return (
    <div className="career-chat-hub">
      <aside className="career-chat-sidebar">
        <div className="career-chat-sidebar-heading">
          <span>Career Explore Chat</span>
          <h1>Hội thoại nghề nghiệp</h1>
        </div>

        {loadingChats && <p className="career-chat-sidebar-status">Đang tải hội thoại...</p>}
        {error && <p className="career-explore-chat-error">{error}</p>}

        {!loadingChats && chats.length === 0 && (
          <div className="career-chat-empty">
            <p>Bạn chưa có cuộc trò chuyện đang dở.</p>
            <Link to="/discovery/recommendations">Khám phá 15 nghề gợi ý</Link>
          </div>
        )}

        <div className="career-chat-list">
          {chats.map((chat) => (
            <Link
              className={`career-chat-list-item ${
                chat.careerId === id ? "active" : ""
              }`}
              key={chat.careerId}
              to={`/career-explore-chats/${chat.careerId}`}
            >
              <strong>{chat.title}</strong>
              {chat.careerCluster && <span>{chat.careerCluster}</span>}
              {chat.lastMessage && <p>{chat.lastMessage}</p>}
              <small>
                {chat.messageCount} tin nhắn · {formatUpdatedAt(chat.updatedAt)}
              </small>
            </Link>
          ))}
        </div>
      </aside>

      <section className="career-chat-main">
        {!id && !loadingChats && chats.length === 0 && (
          <div className="career-chat-placeholder card">
            <h2>Chọn một nghề để bắt đầu trao đổi với AI</h2>
            <p>
              Các cuộc trò chuyện sẽ xuất hiện ở đây sau khi bạn mở Career Explore Chat
              từ trang chi tiết nghề.
            </p>
            <Link className="career-explore-chat-link" to="/discovery/recommendations">
              Xem danh sách nghề gợi ý
            </Link>
          </div>
        )}

        {id && loadingCareer && (
          <p className="career-chat-main-status">Đang tải thông tin nghề nghiệp...</p>
        )}

        {id && !loadingCareer && !career && (
          <div className="career-chat-placeholder card">
            <h2>Không tìm thấy nghề nghiệp</h2>
            <p>Cuộc trò chuyện này có thể trỏ tới một nghề đã bị xoá.</p>
          </div>
        )}

        {id && career && (
          <>
            <div className="career-chat-context">
              <Link to={`/careers/${id}`}>← Xem chi tiết nghề</Link>
              <span>
                {selectedChat?.title || `Tìm hiểu về ngành ${title}`}
              </span>
            </div>
            <CareerExploreChatSection
              careerId={id}
              key={id}
              onSessionChange={loadChats}
              title={title}
            />
          </>
        )}
      </section>
    </div>
  );
}

export default CareerExploreChats;
