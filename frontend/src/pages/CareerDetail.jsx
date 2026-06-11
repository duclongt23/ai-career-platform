import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import api from "../api/axios";
import JobMatchCompareChart from "../components/analytics/JobMatchCompareChart";
import { normalizeCareerClusters } from "../utils/careerCluster";

const DEFAULT_VISIBLE_ELEMENT_COUNT = 5;
const MIN_VISIBLE_ELEMENT_IMPORTANCE = 0.5;
const RIASEC_CODE_INFO = {
  R: {
    title: "Realistic - Kỹ thuật",
    description: "Thích hoạt động thực tế, công cụ, máy móc hoặc môi trường ngoài trời.",
  },
  I: {
    title: "Investigative - Nghiên cứu",
    description: "Thích quan sát, phân tích, tìm nguyên nhân và giải quyết vấn đề.",
  },
  A: {
    title: "Artistic - Nghệ thuật",
    description: "Thích sáng tạo, diễn đạt ý tưởng, thiết kế, viết hoặc biểu diễn.",
  },
  S: {
    title: "Social - Xã hội",
    description: "Thích hỗ trợ, hướng dẫn, đào tạo, chăm sóc hoặc làm việc với con người.",
  },
  E: {
    title: "Enterprising - Quản lý",
    description: "Thích thuyết phục, lãnh đạo, kinh doanh và tạo ảnh hưởng.",
  },
  C: {
    title: "Conventional - Nghiệp vụ",
    description: "Thích quy trình, dữ liệu, hồ sơ và các nhiệm vụ cần sự chính xác.",
  },
};
const ELEMENT_GROUPS = [
  { type: "knowledge", label: "Kiến thức" },
  { type: "essential_skill", label: "Kỹ năng thiết yếu" },
  { type: "transferable_skill", label: "Kỹ năng chuyển đổi" },
  { type: "ability", label: "Năng lực" },
  { type: "workstyle", label: "Phong cách làm việc" },
];
const CAREER_DAY_NODE_TYPES = {
  careerDayActivity: CareerDayActivityNode,
};
const CAREER_EXPLORE_CHAT_STORAGE_PREFIX = "careerExploreChat:v1:";
const MARKET_QUESTION_KEYWORDS = [
  "lương",
  "thu nhập",
  "tuyển dụng",
  "việc làm",
  "thị trường",
  "nhu cầu",
  "cơ hội nghề",
  "xu hướng",
  "doanh nghiệp",
  "job",
  "salary",
];

function getCareerExploreChatStorageKey(careerId) {
  return `${CAREER_EXPLORE_CHAT_STORAGE_PREFIX}${careerId}`;
}

function shouldShowWebSearchStatus(question = "") {
  const normalizedQuestion = String(question).toLocaleLowerCase("vi");

  return MARKET_QUESTION_KEYWORDS.some((keyword) =>
    normalizedQuestion.includes(keyword)
  );
}

function getRiasecCodeDescription(code = "") {
  return String(code)
    .toUpperCase()
    .split("")
    .map((letter) => {
      const info = RIASEC_CODE_INFO[letter];
      return info ? `${letter} - ${info.title}: ${info.description}` : null;
    })
    .filter(Boolean)
    .join(" ");
}

function writeCareerExploreChatSession(
  storageKey,
  { messages, suggestedQuestions }
) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        messages: messages.slice(-80),
        suggestedQuestions,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore storage quota/private mode failures; chat can continue in memory.
  }
}

function CareerDayActivityNode({ data }) {
  return (
    <article className="career-day-node">
      <Handle className="career-day-handle" type="target" position={Position.Top} />
      <span>{String(data.step).padStart(2, "0")}</span>
      <p>{data.activity}</p>
      <Handle
        className="career-day-handle"
        type="source"
        position={Position.Bottom}
      />
    </article>
  );
}

function formatElementCode(code) {
  return String(code || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function CareerFitSection({ careerId, title }) {
  const [fitExplanation, setFitExplanation] = useState(null);
  const [selectedStrengthCode, setSelectedStrengthCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    api
      .post(`/careers/${careerId}/fit-explanation`)
      .then((response) => {
        if (!ignore) {
          setFitExplanation(response.data);
          setSelectedStrengthCode(response.data.selectedStrengthCode);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setError(
            requestError.response?.data?.message ||
              "Không thể tạo lý do phù hợp lúc này. Vui lòng thử lại."
          );
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
  }, [careerId]);

  const generateFitExplanation = useCallback(
    ({ regenerate = false } = {}) => {
      setLoading(true);
      setError("");

      api
        .post(`/careers/${careerId}/fit-explanation`, {
          selectedStrengthCode,
          regenerate,
        })
        .then((response) => {
          setFitExplanation(response.data);
          setSelectedStrengthCode(response.data.selectedStrengthCode);
        })
        .catch((requestError) => {
          setError(
            requestError.response?.data?.message ||
              "Không thể tạo lý do phù hợp lúc này. Vui lòng thử lại."
          );
        })
        .finally(() => setLoading(false));
    },
    [careerId, selectedStrengthCode]
  );

  return (
    <section className="career-fit-section">
      <div className="career-fit-heading">
        <span className="career-fit-icon">✦</span>
        <div>
          <h3>Điểm mạnh phù hợp</h3>
          <p>Khám phá cách điểm mạnh của bạn hỗ trợ cho nghề {title}.</p>
        </div>
      </div>

      {loading && !fitExplanation && (
        <p className="career-fit-status">AI đang phân tích điểm mạnh phù hợp...</p>
      )}

      {error && (
        <div className="career-fit-error">
          <p>{error}</p>
          <button type="button" onClick={() => generateFitExplanation()}>
            Thử lại
          </button>
        </div>
      )}

      {fitExplanation && (
        <>
          <button
            className="career-fit-regenerate"
            type="button"
            disabled={loading}
            onClick={() =>
              generateFitExplanation({
                regenerate: true,
              })
            }
          >
            ✦ {loading ? "Đang tạo..." : "Tạo lại"}
          </button>

          <div className="career-fit-content">
            <div className="career-fit-strengths">
              {fitExplanation.strengths.map((strength) => (
                <button
                  className={
                    strength.code === selectedStrengthCode
                      ? "selected"
                      : ""
                  }
                  type="button"
                  key={strength.code}
                  disabled={loading}
                  onClick={() => setSelectedStrengthCode(strength.code)}
                >
                  {strength.name_vi}
                </button>
              ))}
            </div>

            <div className="career-fit-explanation">
              <p>{fitExplanation.explanations[selectedStrengthCode]}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function CareerDayInLifeSection({ careerId, title }) {
  const [dayInLife, setDayInLife] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dayInLifeDiagram = useMemo(() => {
    const activities = dayInLife?.activities || [];

    return {
      nodes: activities.map((activity, index) => ({
        id: `activity-${index}`,
        type: "careerDayActivity",
        position: {
          x: index % 2 === 0 ? 36 : 440,
          y: index * 132,
        },
        data: {
          activity,
          step: index + 1,
        },
      })),
      edges: activities.slice(0, -1).map((_, index) => ({
        id: `activity-edge-${index}`,
        source: `activity-${index}`,
        target: `activity-${index + 1}`,
        type: "smoothstep",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#0f766e",
        },
        style: {
          stroke: "#0f766e",
          strokeWidth: 2.5,
        },
      })),
    };
  }, [dayInLife]);

  useEffect(() => {
    let ignore = false;

    api
      .post(`/careers/${careerId}/day-in-life`)
      .then((response) => {
        if (!ignore) {
          setDayInLife(response.data);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setError(
            requestError.response?.data?.message ||
              "Không thể tạo lịch làm việc lúc này. Vui lòng thử lại."
          );
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
  }, [careerId]);

  const generateDayInLife = useCallback(({ regenerate = false } = {}) => {
    setLoading(true);
    setError("");

    api
      .post(`/careers/${careerId}/day-in-life`, { regenerate })
      .then((response) => setDayInLife(response.data))
      .catch((requestError) => {
        setError(
          requestError.response?.data?.message ||
            "Không thể tạo lịch làm việc lúc này. Vui lòng thử lại."
        );
      })
      .finally(() => setLoading(false));
  }, [careerId]);

  return (
    <section className="career-day-section">
      <div className="career-day-heading">
        <span className="career-day-icon">▣</span>
        <div>
          <h3>Một ngày làm việc</h3>
          <p>Hình dung một ngày điển hình của nghề {title}.</p>
        </div>
      </div>

      {loading && !dayInLife && (
        <p className="career-day-status">AI đang xây dựng lịch làm việc...</p>
      )}

      {error && (
        <div className="career-day-error">
          <p>{error}</p>
          <button type="button" onClick={() => generateDayInLife()}>
            Thử lại
          </button>
        </div>
      )}

      {dayInLife && (
        <>
          <button
            className="career-day-regenerate"
            type="button"
            disabled={loading}
            onClick={() => generateDayInLife({ regenerate: true })}
          >
            ✦ {loading ? "Đang tạo..." : "Tạo lại"}
          </button>

          <div className="career-day-diagram">
            <ReactFlow
              nodes={dayInLifeDiagram.nodes}
              edges={dayInLifeDiagram.edges}
              nodeTypes={CAREER_DAY_NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.12 }}
              minZoom={0.55}
              maxZoom={1.35}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnScroll
              preventScrolling={false}
            >
              <Background color="#cbd5e1" gap={22} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </>
      )}
    </section>
  );
}

export function CareerExploreChatSection({
  careerId,
  title,
  onSessionChange,
  onSessionDelete,
}) {
  const storageKey = useMemo(
    () => getCareerExploreChatStorageKey(careerId),
    [careerId]
  );
  const [messages, setMessages] = useState([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestStatus, setRequestStatus] = useState("Đang chuẩn bị câu trả lời...");
  const messagesEndRef = useRef(null);

  const addAssistantResponse = useCallback((response) => {
    if (Array.isArray(response.messages)) {
      setMessages(response.messages);
      setSuggestedQuestions(response.suggestedQuestions || []);
      onSessionChange?.(response);
      return;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        role: "assistant",
        content: response.answer,
        sources: response.sources || [],
        webSearchStatus: response.webSearchStatus,
      },
    ]);
    setSuggestedQuestions(response.suggestedQuestions || []);
    onSessionChange?.(response);
  }, [onSessionChange]);

  useEffect(() => {
    let ignore = false;

    api
      .post(`/careers/${careerId}/explore-chat`, { messages: [] })
      .then((response) => {
        if (!ignore) {
          addAssistantResponse(response.data);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setError(
            requestError.response?.data?.message ||
              "Không thể mở cuộc trò chuyện lúc này. Vui lòng thử lại."
          );
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
  }, [addAssistantResponse, careerId]);

  useEffect(() => {
    if (messages.length === 0 && suggestedQuestions.length === 0) {
      return;
    }

    writeCareerExploreChatSession(storageKey, {
      messages,
      suggestedQuestions,
    });
  }, [messages, storageKey, suggestedQuestions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, messages]);

  const sendQuestion = useCallback(
    async (nextQuestion) => {
      const trimmedQuestion = String(nextQuestion || "").trim();

      if (!trimmedQuestion || loading) {
        return;
      }

      setRequestStatus(
        shouldShowWebSearchStatus(trimmedQuestion)
          ? "Đang kiểm tra nguồn web liên quan..."
          : "Đang chuẩn bị câu trả lời..."
      );
      const nextMessages = [
        ...messages.map(({ role, content }) => ({ role, content })),
        { role: "user", content: trimmedQuestion },
      ];

      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "user", content: trimmedQuestion },
      ]);
      setSuggestedQuestions([]);
      setQuestion("");
      setError("");
      setLoading(true);

      try {
        const response = await api.post(`/careers/${careerId}/explore-chat`, {
          messages: nextMessages,
        });
        addAssistantResponse(response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Không thể trả lời câu hỏi lúc này. Vui lòng thử lại."
        );
      } finally {
        setLoading(false);
      }
    },
    [addAssistantResponse, careerId, loading, messages]
  );

  const handleCopyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setError("Không thể sao chép nội dung trong trình duyệt hiện tại.");
    }
  };

  const handleFeedback = async (messageIndex, rating) => {
    const reason =
      rating === "not_helpful"
        ? window.prompt("Bạn muốn AI cải thiện điều gì ở câu trả lời này?") || ""
        : "";

    try {
      await api.post(`/careers/${careerId}/explore-chat/feedback`, {
        messageIndex,
        rating,
        reason,
      });
      setMessages((currentMessages) =>
        currentMessages.map((message, index) =>
          index === messageIndex
            ? {
                ...message,
                feedback: {
                  rating,
                  reason,
                },
              }
            : message
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Không thể lưu đánh giá lúc này. Vui lòng thử lại."
      );
    }
  };

  const handleRegenerateLastAnswer = async () => {
    const lastAssistantIndex = [...messages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(({ message }) => message.role === "assistant")?.index;

    if (lastAssistantIndex == null || loading) {
      return;
    }

    const lastUserMessage = [...messages]
      .slice(0, lastAssistantIndex)
      .reverse()
      .find((message) => message.role === "user");

    setRequestStatus(
      shouldShowWebSearchStatus(lastUserMessage?.content)
        ? "Đang kiểm tra lại nguồn web liên quan..."
        : "Đang tạo lại câu trả lời..."
    );
    setLoading(true);
    setError("");

    try {
      const response = await api.post(`/careers/${careerId}/explore-chat`, {
        messages: messages.map(({ role, content }) => ({ role, content })),
        regenerate: true,
      });
      addAssistantResponse(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Không thể tạo lại câu trả lời lúc này. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!window.confirm("Xóa hội thoại này khỏi lịch sử?")) {
      return;
    }

    try {
      await api.delete(`/careers/${careerId}/explore-chat/session`);
      localStorage.removeItem(storageKey);
      setMessages([]);
      setSuggestedQuestions([]);
      setQuestion("");
      setError("");
      onSessionChange?.();
      onSessionDelete?.();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Không thể xóa hội thoại lúc này. Vui lòng thử lại."
      );
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendQuestion(question);
  };

  const handleNewConversation = () => {
    localStorage.removeItem(storageKey);
    setMessages([]);
    setSuggestedQuestions([]);
    setQuestion("");
    setError("");
    setRequestStatus("Đang chuẩn bị câu trả lời...");
    setLoading(true);
    api
      .post(`/careers/${careerId}/explore-chat`, {
        messages: [],
        reset: true,
      })
      .then((response) => addAssistantResponse(response.data))
      .catch((requestError) => {
        setError(
          requestError.response?.data?.message ||
            "Không thể mở cuộc trò chuyện lúc này. Vui lòng thử lại."
        );
      })
      .finally(() => setLoading(false));
  };

  return (
    <section className="career-explore-chat">
      <div className="career-explore-chat-heading">
        <div>
          <span className="career-explore-chat-eyebrow">Career Explore Chat</span>
          <h3>Hỏi thêm về nghề {title}</h3>
          <p>Trao đổi sâu hơn về công việc, kỹ năng và thị trường Việt Nam.</p>
        </div>
        <div className="career-explore-chat-actions">
          <span className="career-explore-chat-status">AI cố vấn</span>
          <button
            disabled={loading && messages.length === 0}
            onClick={handleNewConversation}
            type="button"
          >
            Tạo trò chuyện mới
          </button>
          <button
            disabled={loading || messages.length === 0}
            onClick={handleDeleteConversation}
            type="button"
          >
            Xóa
          </button>
        </div>
      </div>

      <div className="career-explore-chat-messages">
        {messages.map((message, index) => (
          <div
            className={`career-explore-chat-message ${message.role}`}
            key={`${message.role}-${index}`}
          >
            <strong>{message.role === "assistant" ? "AI cố vấn" : "Bạn"}</strong>
            <p>{message.content}</p>
            {message.sources?.length > 0 && (
              <div className="career-explore-chat-sources">
                <span>Nguồn tham khảo:</span>
                {message.sources.map((source) => (
                  <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                    {source.title}
                  </a>
                ))}
              </div>
            )}
            {message.webSearchStatus === "not_configured" && (
              <small>
                Chưa cấu hình nguồn tìm kiếm web nên câu trả lời không dùng dữ liệu thị
                trường cập nhật.
              </small>
            )}
            {message.role === "assistant" && (
              <div className="career-explore-chat-message-actions">
                <button type="button" onClick={() => handleCopyMessage(message.content)}>
                  Sao chép
                </button>
                {index === messages.length - 1 && (
                  <button
                    disabled={loading}
                    type="button"
                    onClick={handleRegenerateLastAnswer}
                  >
                    Tạo lại
                  </button>
                )}
                <button
                  className={message.feedback?.rating === "helpful" ? "selected" : ""}
                  type="button"
                  onClick={() => handleFeedback(index, "helpful")}
                >
                  Hữu ích
                </button>
                <button
                  className={
                    message.feedback?.rating === "not_helpful" ? "selected" : ""
                  }
                  type="button"
                  onClick={() => handleFeedback(index, "not_helpful")}
                >
                  Chưa tốt
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="career-explore-chat-message assistant pending">
            <strong>AI cố vấn</strong>
            <p>{requestStatus}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <p className="career-explore-chat-error">{error}</p>}

      {suggestedQuestions.length > 0 && (
        <div className="career-explore-chat-suggestions">
          {suggestedQuestions.map((suggestion) => (
            <button
              disabled={loading}
              key={suggestion}
              onClick={() => sendQuestion(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form className="career-explore-chat-composer" onSubmit={handleSubmit}>
        <textarea
          disabled={loading}
          maxLength={1200}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Nhập câu hỏi của bạn về nghề này..."
          rows={3}
          value={question}
        />
        <button disabled={loading || !question.trim()} type="submit">
          Gửi câu hỏi
        </button>
      </form>
    </section>
  );
}

function CareerDetail() {
  const { id } = useParams();
  const token = localStorage.getItem("token");
  const [career, setCareer] = useState(null);
  const [profileElementScores, setProfileElementScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    api
      .get(`/careers/${id}`, { skipAuth: true })
      .then((response) => setCareer(response.data))
      .catch((error) => {
        console.error("Lỗi tải chi tiết nghề nghiệp", error);
        setCareer(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!token) return undefined;

    let ignore = false;

    api
      .get("/profile")
      .then((response) => {
        if (!ignore) {
          setProfileElementScores(response.data?.elementScores || []);
        }
      })
      .catch(() => {
        if (!ignore) {
          setProfileElementScores([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  if (loading) {
    return <p>Đang tải chi tiết...</p>;
  }

  if (!career) {
    return <p>Không tìm thấy nghề nghiệp.</p>;
  }

  const title = career.title_vi || career.name || career.title_en;
  const description = career.description_vi || career.description;
  const careerClusters = normalizeCareerClusters(career.careerCluster || career.field);
  const elements = career.elements || [];
  const importantElements = elements.filter(
    (element) => Number(element.importance || 0) > MIN_VISIBLE_ELEMENT_IMPORTANCE
  );
  const elementGroups = ELEMENT_GROUPS.map((group) => ({
    ...group,
    elements: importantElements
      .filter((element) => element.type === group.type)
      .sort((a, b) => b.importance - a.importance),
  })).filter((group) => group.elements.length > 0);

  const toggleGroup = (type) => {
    setExpandedGroups((currentGroups) => ({
      ...currentGroups,
      [type]: !currentGroups[type],
    }));
  };
  const firstSectionId =
    (career.riasecCode && "career-riasec") ||
    (token && "career-fit") ||
    (token && "career-day") ||
    (importantElements.length > 0 && "career-elements") ||
    "";

  return (
    <div className="career-detail-page">
      <aside className="career-detail-rail" aria-label="Điều hướng trang nghề">
        <a href="#career-overview" aria-label="Tổng quan" />
        {career.riasecCode && <a href="#career-riasec" aria-label="RIASEC" />}
        {token && <a href="#career-fit" aria-label="Điểm mạnh phù hợp" />}
        {token && elements.length > 0 && (
          <a href="#career-match" aria-label="So sánh hồ sơ" />
        )}
        {token && <a href="#career-day" aria-label="Một ngày làm việc" />}
        {importantElements.length > 0 && (
          <a href="#career-elements" aria-label="Kỹ năng quan trọng" />
        )}
      </aside>

      <section className="career-detail-hero" id="career-overview">
        <Link className="career-detail-back" to="/discovery/recommendations">
          ← Quay lại danh sách gợi ý
        </Link>

        <div className="career-detail-hero-copy">
          <span className="career-detail-kicker">Imagine yourself as</span>
          <h1>{title}</h1>
          {career.title_vi && <p className="career-detail-title-en">{career.title_en}</p>}
          <p className="career-detail-description">
            {description || "Đang cập nhật mô tả nghề nghiệp."}
          </p>

          <div className="career-detail-tags">
            {careerClusters.map((cluster) => (
              <span className="tag" key={cluster}>
                {cluster}
              </span>
            ))}
          </div>
        </div>

        {token && (
          <section className="career-explore-chat-cta">
            <div>
              <h3>Bạn vẫn còn câu hỏi về nghề này?</h3>
              <p>
                Trao đổi thêm với AI cố vấn về công việc, kỹ năng và thị trường
                Việt Nam.
              </p>
            </div>
            <Link className="career-explore-chat-link" to={`/careers/${id}/explore-chat`}>
              Tìm hiểu thêm với Career Explore Chat
            </Link>
          </section>
        )}

        {firstSectionId && (
          <a className="career-detail-scroll" href={`#${firstSectionId}`}>
            ↓
          </a>
        )}
      </section>

      <div className="career-detail-sections">
        {career.riasecCode && (
          <section className="career-riasec-summary" id="career-riasec">
            <p className="career-detail-section-eyebrow">Holland code</p>
            <p className="career-riasec-code">
              <span>RIASEC:</span> <strong>{career.riasecCode}</strong>
            </p>
            {getRiasecCodeDescription(career.riasecCode) && (
              <p className="career-riasec-description">
                {getRiasecCodeDescription(career.riasecCode)}
              </p>
            )}
          </section>
        )}

        {token && (
          <div id="career-fit">
            <CareerFitSection careerId={id} title={title} />
          </div>
        )}

        {token && elements.length > 0 && (
          <div id="career-match">
            <JobMatchCompareChart
              careerElements={elements}
              profileElementScores={profileElementScores}
            />
          </div>
        )}

        {token && (
          <div id="career-day">
            <CareerDayInLifeSection careerId={id} title={title} />
          </div>
        )}

        {importantElements.length > 0 && (
          <section className="career-elements-section" id="career-elements">
            <div className="career-elements-heading">
              <p className="career-detail-section-eyebrow">Requirements</p>
              <h3>Năng lực và kỹ năng quan trọng</h3>
            </div>
            <div className="career-element-groups">
              {elementGroups.map((group) => {
                const isExpanded = expandedGroups[group.type];
                const visibleElements = isExpanded
                  ? group.elements
                  : group.elements.slice(0, DEFAULT_VISIBLE_ELEMENT_COUNT);
                const hasHiddenElements =
                  group.elements.length > DEFAULT_VISIBLE_ELEMENT_COUNT;

                return (
                  <section className="career-element-group" key={group.type}>
                    <div className="career-element-group-header">
                      <h4>{group.label}</h4>
                      <span>
                        Hiện {visibleElements.length}/{group.elements.length}
                      </span>
                    </div>

                    <ul className="career-element-list">
                      {visibleElements.map((element) => (
                        <li key={`${element.type}-${element.code}`}>
                          <span>
                            {element.name_vi ||
                              element.name_en ||
                              formatElementCode(element.code)}
                          </span>
                          <strong>{Math.round(element.importance * 100)}%</strong>
                        </li>
                      ))}
                    </ul>

                    {hasHiddenElements && (
                      <button
                        className="career-element-toggle"
                        type="button"
                        onClick={() => toggleGroup(group.type)}
                      >
                        {isExpanded ? "Thu gọn" : `Xem đầy đủ ${group.elements.length} mục`}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          </section>
        )}

        {career.requiredSubjects?.length > 0 && (
          <section className="career-subjects-section">
            <h3>Môn học liên quan</h3>
            <ul>
              {career.requiredSubjects.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export default CareerDetail;
