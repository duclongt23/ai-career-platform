import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { DISCOVERY_PROGRESS_UPDATED } from "../components/DiscoveryWorkflowLayout";

const TYPE_LABELS = {
  ability: "Năng lực",
  workstyle: "Phong cách làm việc",
  transferable_skill: "Kỹ năng chuyển đổi",
  essential_skill: "Kỹ năng nền tảng",
  knowledge: "Kiến thức",
};
const LEVEL_LABELS = {
  1: "Có một chút",
  2: "Khá đúng với mình",
  3: "Rất đúng với mình",
};
const MAX_VISIBLE_MESSAGES = 50;

const keepLatestMessages = (messages = []) =>
  messages.slice(-MAX_VISIBLE_MESSAGES);

const getApiErrorMessage = (err, fallbackMessage) => {
  const message = err.response?.data?.message || fallbackMessage;
  const detail = err.response?.data?.error;

  // Backend trả detail riêng để debug lỗi DeepSeek mà vẫn giữ message chính dễ đọc.
  return detail && detail !== message ? `${message}. Chi tiết: ${detail}` : message;
};

const getSelectedCandidateLevels = (confirmedElements = []) =>
  Object.fromEntries(
    confirmedElements.map((element) => [element.code, Number(element.level)])
  );

function AiDiscoveryPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const messagesEndRef = useRef(null);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [status, setStatus] = useState("in_progress");
  const [selectedCandidates, setSelectedCandidates] = useState({});
  const [openingOptions, setOpeningOptions] = useState([]);
  const [openingQuestionId, setOpeningQuestionId] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isFindingMore, setIsFindingMore] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSelectingOpening, setIsSelectingOpening] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const hydrateSession = useCallback((data = {}) => {
    setSessionId(data.sessionId);
    setMessages(keepLatestMessages(data.messages));
    setCandidates(data.candidates || []);
    setStatus(data.status || "in_progress");
    setOpeningOptions(data.openingOptions || []);
    setOpeningQuestionId(data.openingQuestionId || "");
    // A confirmed session is restored by the backend after a page reload.
    // Hydrate saved levels so disabled controls still show the final state.
    setSelectedCandidates(getSelectedCandidateLevels(data.confirmedElements));
  }, []);

  const loadSession = useCallback(async (currentSessionId = "") => {
    const payload = currentSessionId ? { sessionId: currentSessionId } : {};
    const res = await api.post("/profile/ai-discovery/start", payload);
    hydrateSession(res.data);
  }, [hydrateSession]);

  useEffect(() => {
    if (!token) {
      navigate("/login", {
        state: {
          message: "Yêu cầu đăng nhập để bắt đầu AI Discovery",
          from: "/discovery/ai-discovery",
        },
      });
      return undefined;
    }

    let isMounted = true;

    api
      .post("/profile/ai-discovery/start")
      .then((res) => {
        if (!isMounted) return;

        hydrateSession(res.data);
      })
      .catch((err) => {
        if (!isMounted) return;

        setError(
          getApiErrorMessage(
            err,
            "Chưa thể bắt đầu AI Discovery. Vui lòng thử lại sau."
          )
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hydrateSession, loadSession, navigate, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const selectOpeningQuestion = async (optionId) => {
    if (!optionId || isSelectingOpening) {
      return;
    }

    setIsSelectingOpening(true);
    setError("");

    try {
      const res = await api.post("/profile/ai-discovery/start", {
        sessionId,
        openingQuestionId: optionId,
      });

      hydrateSession(res.data);
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Chưa thể bắt đầu từ câu hỏi này. Vui lòng thử lại."
        )
      );
    } finally {
      setIsSelectingOpening(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();

    const content = input.trim();

    if (
      !content ||
      isSending ||
      ["ready_to_confirm", "confirmed"].includes(status)
    ) {
      return;
    }

    const previousMessages = messages;
    const userMessage = {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    // Hiển thị câu trả lời ngay để trải nghiệm chat không bị khựng trong lúc chờ AI.
    setMessages(keepLatestMessages([...previousMessages, userMessage]));
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const res = await api.post("/profile/ai-discovery/message", {
        message: content,
        sessionId,
      });

      setSessionId(res.data.sessionId);
      setStatus(res.data.status || "in_progress");
      setCandidates(res.data.candidates || []);
      setOpeningOptions(res.data.openingOptions || openingOptions);
      setOpeningQuestionId(res.data.openingQuestionId || openingQuestionId);
      setSelectedCandidates({});
      setMessages((currentMessages) =>
        keepLatestMessages([
          ...currentMessages,
          {
            role: "assistant",
            content: res.data.assistantMessage,
            createdAt: new Date().toISOString(),
          },
        ])
      );
    } catch (err) {
      const persistedSessionId = err.response?.data?.sessionId;

      if (persistedSessionId) {
        // Backend đã lưu user message trước khi gọi DeepSeek. Load lại để UI khớp DB.
        setSessionId(persistedSessionId);

        try {
          await loadSession(persistedSessionId);
        } catch {
          // Giữ optimistic message nếu lần đồng bộ lại cũng thất bại.
        }
      } else {
        // Lỗi validation xảy ra trước khi lưu, nên bỏ optimistic message khỏi UI.
        setMessages(previousMessages);
      }

      setError(
        getApiErrorMessage(err, "AI chưa phản hồi được. Vui lòng thử lại sau.")
      );
    } finally {
      setIsSending(false);
    }
  };

  const resetSession = async () => {
    const shouldReset = window.confirm(
      "Bắt đầu lại sẽ tạo cuộc trò chuyện mới. Bạn có muốn tiếp tục không?"
    );

    if (
      !shouldReset ||
      isSending ||
      isResetting ||
      isConfirming ||
      isFindingMore ||
      isSelectingOpening
    ) {
      return;
    }

    setIsResetting(true);
    setError("");

    try {
      const res = await api.post("/profile/ai-discovery/reset");

      hydrateSession(res.data);
      setInput("");
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Chưa thể bắt đầu lại cuộc trò chuyện. Vui lòng thử lại sau."
        )
      );
    } finally {
      setIsResetting(false);
    }
  };

  const toggleCandidate = (code) => {
    setSelectedCandidates((current) => {
      if (current[code]) {
        const next = { ...current };
        delete next[code];
        return next;
      }

      return {
        ...current,
        [code]: 2,
      };
    });
  };

  const updateCandidateLevel = (code, level) => {
    setSelectedCandidates((current) => ({
      ...current,
      [code]: Number(level),
    }));
  };

  const findMoreCandidates = async () => {
    if (status !== "ready_to_confirm" || isFindingMore || isConfirming) {
      return;
    }

    setIsFindingMore(true);
    setError("");

    try {
      const res = await api.post("/profile/ai-discovery/more-candidates", {
        sessionId,
        selectedCodes: Object.keys(selectedCandidates),
      });

      setSessionId(res.data.sessionId);
      setStatus(res.data.status || "ready_to_confirm");
      setCandidates(res.data.candidates || []);
      setOpeningOptions(res.data.openingOptions || openingOptions);
      setOpeningQuestionId(res.data.openingQuestionId || openingQuestionId);

      if (res.data.assistantMessage) {
        setMessages((currentMessages) =>
          keepLatestMessages([
            ...currentMessages,
            {
              role: "assistant",
              content: res.data.assistantMessage,
              createdAt: new Date().toISOString(),
            },
          ])
        );
      }
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Chưa thể tìm thêm yếu tố mới. Vui lòng thử lại sau."
        )
      );
    } finally {
      setIsFindingMore(false);
    }
  };

  const confirmCandidates = async () => {
    const elements = Object.entries(selectedCandidates).map(([code, level]) => ({
      code,
      level,
    }));

    if (elements.length === 0 || isConfirming || isFindingMore) {
      return;
    }

    setIsConfirming(true);
    setError("");

    try {
      const res = await api.post("/profile/ai-discovery/confirm", {
        sessionId,
        elements,
      });

      setStatus(res.data.status);
      setSelectedCandidates(
        getSelectedCandidateLevels(res.data.confirmedElements)
      );
      window.dispatchEvent(new Event(DISCOVERY_PROGRESS_UPDATED));
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Chưa thể lưu các yếu tố đã chọn. Vui lòng thử lại sau."
        )
      );
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <section className="card ai-discovery-card">
        <p className="muted">Đang bắt đầu cuộc trò chuyện...</p>
      </section>
    );
  }

  if (error && messages.length === 0 && openingOptions.length === 0) {
    return (
      <section className="card ai-discovery-card">
        <p className="error">{error}</p>
        <p className="muted">
          Nếu chưa có kết quả RIASEC, hãy hoàn thành bài test trước.
        </p>
        <Link className="ai-discovery-link" to="/discovery/riasec">
          Đi tới bài test RIASEC
        </Link>
      </section>
    );
  }

  const shouldSelectOpening =
    messages.length === 0 && status === "in_progress" && openingOptions.length > 0;

  return (
    <div className="ai-discovery-page">
      <section className="ai-discovery-header">
        <p className="ai-discovery-eyebrow">AI Discovery</p>
        <h1>Trò chuyện để hiểu rõ hơn về bản thân</h1>
        <p>
          Chia sẻ theo trải nghiệm thật của bạn. AI sẽ hỏi thêm khi cần và gợi ý
          các yếu tố phù hợp để bạn xem lại.
        </p>
      </section>

      {shouldSelectOpening ? (
        <section className="card ai-discovery-start-card">
          <div className="ai-discovery-start-heading">
            <p className="ai-discovery-eyebrow">Chọn điểm bắt đầu</p>
            <h2>Em muốn mở cuộc trò chuyện từ đâu?</h2>
            <p>
              Chọn một câu gần với trải nghiệm của em nhất. Các câu được gợi ý
              theo RIASEC sẽ hiện trước, nhưng em có thể chọn bất kỳ hướng nào.
            </p>
          </div>

          {error && <p className="error ai-discovery-error">{error}</p>}

          <div className="ai-discovery-opening-grid">
            {openingOptions.map((option) => (
              <button
                className="ai-discovery-opening-option"
                type="button"
                key={option.id}
                onClick={() => selectOpeningQuestion(option.id)}
                disabled={isSelectingOpening}
              >
                <span>
                  {option.isRecommended ? "Gợi ý từ RIASEC" : "Câu hỏi mở"}
                </span>
                <strong>{option.title}</strong>
                <p>{option.question}</p>
              </button>
            ))}
          </div>
        </section>
      ) : (
      <section className="card ai-discovery-chat-card">
        <div className="ai-discovery-chat-heading">
          <div>
            <strong>Career discovery mentor</strong>
            <span>{isSending ? "Đang suy nghĩ..." : "Sẵn sàng trò chuyện"}</span>
          </div>
          <div className="ai-discovery-chat-actions">
            <span className="ai-discovery-session-status">
              {status === "confirmed"
                ? "Đã xác nhận"
                : status === "ready_to_confirm"
                  ? "Chờ xác nhận"
                  : "Đang khám phá"}
            </span>
            <button
              className="ai-discovery-reset-button"
              type="button"
              onClick={resetSession}
              disabled={
                isSending ||
                isResetting ||
                isConfirming ||
                isFindingMore ||
                isSelectingOpening
              }
            >
              {isResetting ? "Đang bắt đầu lại..." : "Bắt đầu lại"}
            </button>
          </div>
        </div>

        <div className="ai-discovery-messages" aria-live="polite">
          {messages.map((message, index) => (
            <article
              className={`ai-discovery-message ${message.role}`}
              key={`${message.role}-${message.createdAt || index}-${index}`}
            >
              <span>{message.role === "assistant" ? "AI mentor" : "Bạn"}</span>
              <p>{message.content}</p>
            </article>
          ))}

          {isSending && (
            <article className="ai-discovery-message assistant pending">
              <span>AI mentor</span>
              <p>Đang suy nghĩ...</p>
            </article>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && <p className="error ai-discovery-error">{error}</p>}

        <form className="ai-discovery-composer" onSubmit={sendMessage}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              status === "confirmed"
                ? "Các lựa chọn đã được lưu vào hồ sơ."
                : status === "ready_to_confirm"
                  ? "AI đã đưa ra gợi ý để bạn xem lại."
                  : "Nhập câu trả lời của bạn..."
            }
            rows="3"
            maxLength="2000"
            disabled={
              isSending || ["ready_to_confirm", "confirmed"].includes(status)
            }
          />
          <div className="ai-discovery-composer-footer">
            <span>{input.length}/2000</span>
            <button
              type="submit"
              disabled={
                !input.trim() ||
                isSending ||
                ["ready_to_confirm", "confirmed"].includes(status)
              }
            >
              {isSending ? "Đang gửi..." : "Gửi trả lời"}
            </button>
          </div>
        </form>
      </section>
      )}

      {candidates.length > 0 && (
        <section className="card ai-discovery-candidate-panel">
          <div className="ai-discovery-candidate-heading">
            <p className="ai-discovery-eyebrow">Candidate elements</p>
            <h2>Các yếu tố AI nhận thấy từ cuộc trò chuyện</h2>
            <p>
              Chọn những yếu tố đúng với bạn và đánh giá mức độ phù hợp trước
              khi lưu vào hồ sơ.
            </p>
          </div>

          <div className="ai-discovery-candidate-grid">
            {candidates.map((candidate) => (
              <article
                className={`ai-discovery-candidate ${
                  selectedCandidates[candidate.code] ? "selected" : ""
                }`}
                key={candidate.code}
              >
                <div className="ai-discovery-candidate-meta">
                  <label className="ai-discovery-candidate-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCandidates[candidate.code])}
                      onChange={() => toggleCandidate(candidate.code)}
                      disabled={status === "confirmed"}
                    />
                    <span>{TYPE_LABELS[candidate.type] || candidate.type}</span>
                  </label>
                  <strong>{Math.round(candidate.confidence * 100)}%</strong>
                </div>
                <h3>{candidate.name_vi || candidate.code}</h3>
                <p>{candidate.reason}</p>
                <small>{candidate.code}</small>

                {selectedCandidates[candidate.code] && (
                  <label className="ai-discovery-level">
                    Mức độ phù hợp
                    <select
                      value={selectedCandidates[candidate.code]}
                      onChange={(event) =>
                        updateCandidateLevel(candidate.code, event.target.value)
                      }
                      disabled={status === "confirmed"}
                    >
                      {Object.entries(LEVEL_LABELS).map(([level, label]) => (
                        <option key={level} value={level}>
                          {level} - {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </article>
            ))}
          </div>

          <div className="ai-discovery-confirm-footer">
            <span>
              Đã chọn {Object.keys(selectedCandidates).length} /{" "}
              {candidates.length} yếu tố
            </span>
            {status === "confirmed" ? (
              <div className="ai-discovery-confirmed-actions">
                <strong>Đã lưu vào hồ sơ</strong>
                <Link
                  className="workflow-next-action"
                  to="/discovery/dashboard"
                >
                  Xem gợi ý nghề nghiệp
                </Link>
              </div>
            ) : (
              <div className="ai-discovery-confirm-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={findMoreCandidates}
                  disabled={
                    status !== "ready_to_confirm" ||
                    isFindingMore ||
                    isConfirming
                  }
                >
                  {isFindingMore ? "Đang tìm thêm..." : "Tìm thêm yếu tố"}
                </button>
                <button
                  type="button"
                  onClick={confirmCandidates}
                  disabled={
                    Object.keys(selectedCandidates).length === 0 ||
                    isConfirming ||
                    isFindingMore
                  }
                >
                  {isConfirming ? "Đang lưu..." : "Xác nhận lựa chọn"}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default AiDiscoveryPage;
