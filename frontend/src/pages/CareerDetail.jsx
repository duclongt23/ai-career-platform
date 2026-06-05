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

const DEFAULT_VISIBLE_ELEMENT_COUNT = 10;
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

function getCareerExploreChatStorageKey(careerId) {
  return `${CAREER_EXPLORE_CHAT_STORAGE_PREFIX}${careerId}`;
}

function readCareerExploreChatSession(storageKey) {
  try {
    const parsedSession = JSON.parse(localStorage.getItem(storageKey) || "{}");

    return {
      messages: Array.isArray(parsedSession.messages)
        ? parsedSession.messages
        : [],
      suggestedQuestions: Array.isArray(parsedSession.suggestedQuestions)
        ? parsedSession.suggestedQuestions
        : [],
    };
  } catch {
    return {
      messages: [],
      suggestedQuestions: [],
    };
  }
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

export function CareerExploreChatSection({ careerId, title }) {
  const storageKey = useMemo(
    () => getCareerExploreChatStorageKey(careerId),
    [careerId]
  );
  const [messages, setMessages] = useState(() =>
    readCareerExploreChatSession(storageKey).messages
  );
  const [suggestedQuestions, setSuggestedQuestions] = useState(
    () => readCareerExploreChatSession(storageKey).suggestedQuestions
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(() => messages.length === 0);
  const [error, setError] = useState("");
  const [conversationVersion, setConversationVersion] = useState(0);
  const messagesEndRef = useRef(null);

  const addAssistantResponse = useCallback((response) => {
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
  }, []);

  useEffect(() => {
    let ignore = false;
    const savedSession = readCareerExploreChatSession(storageKey);

    if (savedSession.messages.length > 0) {
      queueMicrotask(() => {
        if (!ignore) {
          setMessages(savedSession.messages);
          setSuggestedQuestions(savedSession.suggestedQuestions);
          setQuestion("");
          setError("");
          setLoading(false);
        }
      });

      return () => {
        ignore = true;
      };
    }

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
  }, [addAssistantResponse, careerId, conversationVersion, storageKey]);

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
    setLoading(true);
    setConversationVersion((currentVersion) => currentVersion + 1);
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
          </div>
        ))}

        {loading && (
          <div className="career-explore-chat-message assistant pending">
            <strong>AI cố vấn</strong>
            <p>Đang chuẩn bị câu trả lời...</p>
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
      .get(`/careers/${id}`)
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
  const elements = career.elements || [];
  const elementGroups = ELEMENT_GROUPS.map((group) => ({
    ...group,
    elements: elements
      .filter((element) => element.type === group.type)
      .sort((a, b) => b.importance - a.importance),
  })).filter((group) => group.elements.length > 0);

  const toggleGroup = (type) => {
    setExpandedGroups((currentGroups) => ({
      ...currentGroups,
      [type]: !currentGroups[type],
    }));
  };

  return (
    <div className="card detail-card">
      <Link to="/discovery/recommendations">← Quay lại danh sách gợi ý</Link>

      <h1>{title}</h1>

      {(career.careerCluster || career.field) && (
        <span className="tag">{career.careerCluster || career.field}</span>
      )}

      {career.title_vi && <p className="muted">{career.title_en}</p>}
      <p>{description || "Đang cập nhật mô tả nghề nghiệp."}</p>

      {career.riasecCode && (
        <section>
          <h3>Mã RIASEC</h3>
          <p>{career.riasecCode}</p>
        </section>
      )}

      {token && <CareerFitSection careerId={id} title={title} />}
      {token && elements.length > 0 && (
        <JobMatchCompareChart
          careerElements={elements}
          profileElementScores={profileElementScores}
        />
      )}
      {token && <CareerDayInLifeSection careerId={id} title={title} />}
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

      {elements.length > 0 && (
        <section>
          <h3>Năng lực và kỹ năng quan trọng</h3>
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
        <section>
          <h3>Môn học liên quan</h3>
          <ul>
            {career.requiredSubjects.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default CareerDetail;
