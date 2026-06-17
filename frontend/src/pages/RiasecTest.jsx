import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { DISCOVERY_PROGRESS_UPDATED } from "../components/DiscoveryWorkflowLayout";
import {
  clearDiscoveryDraft,
  getDiscoveryDraftKey,
  readDiscoveryDraft,
  writeDiscoveryDraft,
} from "../utils/discoveryDrafts";
import { getStoredUser } from "../utils/storage";

const RIASEC_TYPES = [
  "REALISTIC",
  "INVESTIGATIVE",
  "ARTISTIC",
  "SOCIAL",
  "ENTERPRISING",
  "CONVENTIONAL",
];

const TYPE_INFO = {
  REALISTIC: {
    code: "R",
    name: "Realistic",
    viName: "Nhóm người Kỹ thuật",
    description:
      "Thích làm với những vật cụ thể, máy móc, dụng cụ, cây cối, con vật hoặc các hoạt động ngoài trời.",
  },
  INVESTIGATIVE: {
    code: "I",
    name: "Investigative",
    viName: "Nhóm người Nghiên cứu",
    description:
      "Thích quan sát, tìm tòi, điều tra, phân tích, đánh giá hoặc giải quyết vấn đề.",
  },
  ARTISTIC: {
    code: "A",
    name: "Artistic",
    viName: "Nhóm người Nghệ thuật:",
    description:
      "Có khả năng nghệ thuật, sáng tác, trực giác và thích làm việc trong các tình huống không có kế hoạch trước như dùng trí tưởng tượng và sáng tạo.",
  },
  SOCIAL: {
    code: "S",
    name: "Social",
    viName: "Nhóm người Xã hội",
    description:
      "Thích làm việc cung cấp hoặc làm sáng tỏ thông tin, thích giúp đỡ, huấn luyện, chữa trị hoặc chăm sóc sức khỏe cho người khác, có khả năng về ngôn ngữ.",
  },
  ENTERPRISING: {
    code: "E",
    name: "Enterprising",
    viName: "Nhóm người Quản lý",
    description:
      "Thích làm việc với những người khác, có khả năng tác động, thuyết phục, thể hiện, lãnh đạo hoặc quản lý các mục tiêu của tổ chức, các lợi ích kinh tế.",
  },
  CONVENTIONAL: {
    code: "C",
    name: "Conventional",
    viName: "Nghiệp vụ",
    description:
      "Thích làm việc với dữ liệu, con số, có khả năng làm việc văn phòng, thống kê, thực hiện các công việc đòi hỏi chi tiết, tỉ mỉ, cẩn thận hoặc làm theo hướng dẫn của người khác.",
  },
};

const ANSWER_OPTIONS = [
  { label: "Hoàn toàn không thích", value: 0 },
  { label: "Không thích", value: 1 },
  { label: "Trung lập", value: 2 },
  { label: "Thích", value: 3 },
  { label: "Rất thích", value: 4 },
];

const HOLLAND_TYPES = [
  {
    code: "R",
    title: "Realistic - Kỹ thuật",
    text: "Thích thao tác với công cụ, máy móc, vật thể, cây cối, động vật hoặc các hoạt động thực tế ngoài trời.",
  },
  {
    code: "I",
    title: "Investigative - Nghiên cứu",
    text: "Thích quan sát, phân tích, tìm hiểu nguyên nhân và giải quyết vấn đề bằng dữ liệu hoặc lập luận.",
  },
  {
    code: "A",
    title: "Artistic - Nghệ thuật",
    text: "Thích sáng tạo, diễn đạt ý tưởng, thiết kế, viết, biểu diễn hoặc làm việc trong môi trường linh hoạt.",
  },
  {
    code: "S",
    title: "Social - Xã hội",
    text: "Thích hỗ trợ, hướng dẫn, đào tạo, chăm sóc hoặc làm việc trực tiếp với con người.",
  },
  {
    code: "E",
    title: "Enterprising - Quản lý",
    text: "Thích thuyết phục, lãnh đạo, kinh doanh, tổ chức nguồn lực và tạo ảnh hưởng đến người khác.",
  },
  {
    code: "C",
    title: "Conventional - Nghiệp vụ",
    text: "Thích làm việc có quy trình, dữ liệu, con số, hồ sơ và các nhiệm vụ cần sự chính xác, trật tự.",
  },
];

const createEmptyScores = () =>
  RIASEC_TYPES.reduce((scores, type) => ({ ...scores, [type]: 0 }), {});

const RIASEC_DRAFT_VERSION = 1;

const buildRiasecDraft = ({ answers, currentIndex }) => ({
  version: RIASEC_DRAFT_VERSION,
  hasStarted: true,
  answers,
  currentIndex,
});

const isRestorableRiasecDraft = (draft) =>
  draft?.version === RIASEC_DRAFT_VERSION &&
  draft.hasStarted === true &&
  draft.answers &&
  typeof draft.answers === "object";

const restoreRiasecDraftState = (questionList = [], draft) => {
  if (!isRestorableRiasecDraft(draft)) {
    return {
      answers: {},
      currentIndex: 0,
    };
  }

  const validQuestionIds = new Set(
    questionList.map((question) => String(question.id))
  );
  const restoredAnswers = Object.entries(draft.answers).reduce(
    (nextAnswers, [questionId, value]) => {
      const numericValue = Number(value);

      if (
        validQuestionIds.has(String(questionId)) &&
        Number.isInteger(numericValue) &&
        numericValue >= 0 &&
        numericValue <= 4
      ) {
        nextAnswers[questionId] = numericValue;
      }

      return nextAnswers;
    },
    {}
  );
  const firstUnansweredIndex = questionList.findIndex(
    (question) => restoredAnswers[question.id] === undefined
  );
  const fallbackIndex =
    firstUnansweredIndex >= 0
      ? firstUnansweredIndex
      : Math.max(questionList.length - 1, 0);
  const draftCurrentIndex = Number(draft.currentIndex);

  return {
    answers: restoredAnswers,
    currentIndex: Math.max(
      0,
      Math.min(
        Number.isInteger(draftCurrentIndex) ? draftCurrentIndex : fallbackIndex,
        fallbackIndex
      )
    ),
  };
};

const calculateResults = (questions, answers) => {
  const scores = createEmptyScores();
  const counts = createEmptyScores();

  questions.forEach((question) => {
    counts[question.type] += 1;
    scores[question.type] += answers[question.id] ?? 0;
  });

  return RIASEC_TYPES.map((type) => {
    const maxScore = counts[type] * 4 || 1;
    const score = scores[type];
    const percent = Math.round((score / maxScore) * 100);

    return {
      type,
      score,
      percent,
      maxScore,
      ...TYPE_INFO[type],
    };
  }).sort((a, b) => b.score - a.score);
};

const buildSavedResults = (riasecScores = {}, riasecCode = "", questions = []) => {
  const counts = createEmptyScores();
  const codeOrder = String(riasecCode || "")
    .toUpperCase()
    .split("")
    .reduce((order, code, index) => ({ ...order, [code]: index }), {});

  questions.forEach((question) => {
    if (counts[question.type] !== undefined) {
      counts[question.type] += 1;
    }
  });

  return RIASEC_TYPES.map((type) => {
    const score = Number(riasecScores?.[type] || 0);
    const maxScore = counts[type] * 4 || 20;
    const percent = Math.round((score / maxScore) * 100);

    return {
      type,
      score,
      percent,
      maxScore,
      ...TYPE_INFO[type],
    };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aOrder = codeOrder[a.code] ?? RIASEC_TYPES.length;
    const bOrder = codeOrder[b.code] ?? RIASEC_TYPES.length;
    return aOrder - bOrder;
  });
};

const toRadians = (degrees) => (Math.PI / 180) * degrees;

const getRadarPoint = (index, total, radius, center) => {
  const angle = toRadians(-90 + (360 / total) * index);

  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
};

const getInterestProfileSummary = (topResults) => {
  if (topResults.length < 2) return "Chưa đủ dữ liệu để đọc xu hướng nổi bật.";

  return `${topResults[0].viName.replace("Nhóm người ", "")} - ${topResults[1].viName.replace("Nhóm người ", "")}`;
};

function RiasecRadarChart({ results, topResults }) {
  const center = 150;
  const radius = 92;
  const levels = [0.25, 0.5, 0.75, 1];
  const chartResults = RIASEC_TYPES.map((type) => {
    const result = results.find((item) => item.type === type);
    return result || { type, percent: 0, ...TYPE_INFO[type] };
  });
  const topCodes = new Set(topResults.map((item) => item.code));
  const polygonPoints = chartResults
    .map((item, index) => {
      const point = getRadarPoint(
        index,
        chartResults.length,
        radius * Math.max(0, Math.min(item.percent, 100)) * 0.01,
        center
      );

      return `${point.x},${point.y}`;
    })
    .join(" ");
  const profileSummary = getInterestProfileSummary(topResults);

  return (
    <div className="riasec-radar-panel">
      <div className="riasec-radar-copy">
        <p className="riasec-eyebrow">Mạng nhện sở thích</p>
        <h3>Hình khối RIASEC đang nghiêng về {profileSummary}</h3>
        <p>
          Radar hiển thị đủ 6 nhóm R-I-A-S-E-C. Các đỉnh vươn xa hơn cho thấy
          nhóm sở thích nổi bật hơn so với phần còn lại.
        </p>
      </div>

      <div className="riasec-radar-visual" aria-label="Biểu đồ mạng nhện RIASEC">
        <svg viewBox="0 0 300 300" role="img">
          <title>Biểu đồ radar điểm RIASEC</title>
          <desc>Hiển thị phần trăm điểm của sáu nhóm Realistic, Investigative, Artistic, Social, Enterprising và Conventional.</desc>
          {levels.map((level) => (
            <polygon
              key={level}
              className="riasec-radar-grid"
              points={chartResults
                .map((_, index) => {
                  const point = getRadarPoint(
                    index,
                    chartResults.length,
                    radius * level,
                    center
                  );
                  return `${point.x},${point.y}`;
                })
                .join(" ")}
            />
          ))}

          {chartResults.map((_, index) => {
            const point = getRadarPoint(index, chartResults.length, radius, center);
            return (
              <line
                key={index}
                className="riasec-radar-axis"
                x1={center}
                y1={center}
                x2={point.x}
                y2={point.y}
              />
            );
          })}

          <polygon className="riasec-radar-area" points={polygonPoints} />
          <polyline className="riasec-radar-line" points={`${polygonPoints} ${polygonPoints.split(" ")[0]}`} />

          {chartResults.map((item, index) => {
            const valuePoint = getRadarPoint(
              index,
              chartResults.length,
              radius * Math.max(0, Math.min(item.percent, 100)) * 0.01,
              center
            );
            const labelPoint = getRadarPoint(index, chartResults.length, radius + 30, center);
            const isTop = topCodes.has(item.code);

            return (
              <g key={item.type}>
                <circle
                  className={isTop ? "riasec-radar-dot top" : "riasec-radar-dot"}
                  cx={valuePoint.x}
                  cy={valuePoint.y}
                  r={isTop ? 5 : 4}
                />
                <text
                  className={isTop ? "riasec-radar-label top" : "riasec-radar-label"}
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {item.code}
                </text>
                <text
                  className="riasec-radar-value"
                  x={labelPoint.x}
                  y={labelPoint.y + 15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {item.percent}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function RiasecTest() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  const draftKey = getDiscoveryDraftKey("riasec", user);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [savedResult, setSavedResult] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login", {
        state: {
          message: "Yêu cầu đăng nhập để thực hiện bài test",
          from: "/discovery/riasec",
        },
      });
      return undefined;
    }

    return undefined;
  }, [navigate, token]);

  useEffect(() => {
    if (!token) return undefined;

    let isMounted = true;
    const draft = readDiscoveryDraft(draftKey);

    api
      .get("/profile")
      .then((res) => {
        if (!isMounted) return;

        if (isRestorableRiasecDraft(draft)) {
          setHasStarted(true);
          setSavedResult(null);
          setHasSubmitted(false);
          setSaveStatus("idle");
          setIsLoading(true);
          return;
        }

        if (res.data?.riasecCode && res.data?.riasecScores) {
          setSavedResult({
            code: res.data.riasecCode,
            scores: res.data.riasecScores,
          });
          setHasSubmitted(false);
          setSaveStatus("saved");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [draftKey, token]);

  const fetchQuestions = useCallback((draft = null) => {
    setIsLoading(true);

    return api
      .get("/riasec/questions")
      .then((res) => {
        const questionList = res.data;

        setError("");
        setQuestions(questionList);

        if (isRestorableRiasecDraft(draft)) {
          const restoredDraft = restoreRiasecDraftState(questionList, draft);

          setAnswers(restoredDraft.answers);
          setCurrentIndex(restoredDraft.currentIndex);
          setSavedResult(null);
          setHasSubmitted(false);
          setSaveStatus("idle");
        }
      })
      .catch(() => {
        setError("Không tải được bộ câu hỏi RIASEC. Vui lòng thử lại sau.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!token || !hasStarted || questions.length > 0) return;

    const draft = readDiscoveryDraft(draftKey);

    if (isRestorableRiasecDraft(draft)) {
      fetchQuestions(draft);
    }
  }, [draftKey, fetchQuestions, hasStarted, questions.length, token]);

  const startAssessment = () => {
    clearDiscoveryDraft(draftKey);
    setSavedResult(null);
    setHasSubmitted(false);
    setHasStarted(true);
    setAnswers({});
    setCurrentIndex(0);
    setSaveStatus("idle");
    fetchQuestions();
  };

  const answeredCount = Object.keys(answers).length;
  const hasAnsweredAll = questions.length > 0 && answeredCount === questions.length;
  const shouldShowResult = hasSubmitted || Boolean(savedResult);
  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  useEffect(() => {
    if (
      !token ||
      !hasStarted ||
      questions.length === 0 ||
      savedResult ||
      hasSubmitted
    ) {
      return;
    }

    writeDiscoveryDraft(
      draftKey,
      buildRiasecDraft({ answers, currentIndex })
    );
  }, [
    answers,
    currentIndex,
    draftKey,
    hasSubmitted,
    hasStarted,
    questions.length,
    savedResult,
    token,
  ]);

  const results = useMemo(
    () => calculateResults(questions, answers),
    [answers, questions]
  );

  const savedResults = useMemo(
    () =>
      savedResult
        ? buildSavedResults(savedResult.scores, savedResult.code, questions)
        : [],
    [questions, savedResult]
  );

  const displayedResults = savedResult && !hasSubmitted ? savedResults : results;
  const topResults = displayedResults.slice(0, 3);

  const saveRiasecResult = async (nextAnswers) => {
    const token = localStorage.getItem("token");

    setHasSubmitted(true);

    if (!token) {
      setSaveStatus("guest");
      return;
    }

    const finalResults = calculateResults(questions, nextAnswers);
    const riasecCode = finalResults.map((item) => item.code).slice(0, 3).join("");
    const riasecScores = finalResults.reduce((scores, item) => {
      scores[item.type] = item.score;
      return scores;
    }, {});

    try {
      setSaveStatus("saving");
      await api.put("/profile/riasec", {
        riasecCode,
        riasecScores,
      });
      setSavedResult({
        code: riasecCode,
        scores: riasecScores,
      });
      clearDiscoveryDraft(draftKey);
      setSaveStatus("saved");
      window.dispatchEvent(new Event(DISCOVERY_PROGRESS_UPDATED));
    } catch {
      setSaveStatus("error");
    }
  };

  const handleAnswer = (value, event) => {
    event?.currentTarget?.blur();

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const goToNext = () => {
    if (!currentQuestion || answers[currentQuestion.id] === undefined) return;

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (hasAnsweredAll) {
      saveRiasecResult(answers);
    }
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const restartTest = () => {
    clearDiscoveryDraft(draftKey);
    setSavedResult(null);
    setHasSubmitted(false);
    setHasStarted(true);
    setAnswers({});
    setCurrentIndex(0);
    setSaveStatus("idle");

    if (questions.length === 0) {
      fetchQuestions();
    }
  };

  if (isProfileLoading) {
    return (
      <section className="card riasec-card">
        <p className="muted">Đang tải kết quả RIASEC...</p>
      </section>
    );
  }

  if (!hasStarted && !savedResult) {
    return (
      <div className="riasec-page">
        <section className="riasec-intro-hero">
          <div>
            <p className="riasec-eyebrow">Holland Code (RIASEC)</p>
            <h1>Hiểu sở thích nghề nghiệp trước khi chọn hướng đi</h1>
            <p>
              Holland Code là mô hình phân loại sở thích nghề nghiệp thành 6
              nhóm tính cách. Bài test này giúp bạn nhận diện các nhóm nổi bật
              nhất để tham khảo khi khám phá ngành học và nghề nghiệp phù hợp.
            </p>
            <Link className="riasec-info-link" to="/riasec-info">
              RIASEC là gì?
            </Link>
          </div>
          <button type="button" onClick={startAssessment}>
            Bắt đầu làm bài
          </button>
        </section>

        <section className="riasec-intro-panel background">
          <h2>Nền tảng lý thuyết</h2>
          <p>
            Lý thuyết Holland Occupational Themes do nhà tâm lý học John L.
            Holland phát triển từ thập niên 1950. Mô hình cho rằng con người và
            môi trường nghề nghiệp có thể được mô tả qua sáu nhóm: Realistic,
            Investigative, Artistic, Social, Enterprising và Conventional, gọi
            tắt là RIASEC.
          </p>
          <p>
            Khi sở thích, năng lực và môi trường làm việc có mức độ phù hợp cao,
            người học hoặc người đi làm thường dễ duy trì động lực, phát triển
            kỹ năng và cảm thấy rõ ràng hơn trong lựa chọn nghề nghiệp.
          </p>
        </section>

        <section className="riasec-type-grid" aria-label="Sáu nhóm RIASEC">
          {HOLLAND_TYPES.map((item) => (
            <article key={item.code} className="riasec-type-card">
              <span>{item.code}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="riasec-intro-panel instructions">
          <h2>Hướng dẫn làm bài</h2>
          <p>
            Bài test gồm {questions.length || 30} hoạt động. Với mỗi hoạt động,
            hãy chọn mức độ bạn muốn thực hiện: hoàn toàn không thích, không
            thích, trung lập, thích hoặc rất thích. Không có đáp án đúng sai;
            hãy trả lời theo cảm nhận tự nhiên của bạn.
          </p>
        </section>

        <section className="riasec-intro-panel notice">
          <h2>Lưu ý sử dụng</h2>
          <p>
            Kết quả chỉ dùng cho mục đích định hướng học tập và tham khảo nghề
            nghiệp, không phải chẩn đoán tâm lý hay quyết định bắt buộc. Kết quả
            của bạn sẽ được lưu vào hồ sơ để hệ thống có thể gợi ý ngành nghề
            phù hợp hơn.
          </p>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <section className="card riasec-card">
        <p className="muted">Đang tải bộ câu hỏi RIASEC...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card riasec-card">
        <p className="error">{error}</p>
        <button type="button" onClick={fetchQuestions}>
          Tải lại
        </button>
      </section>
    );
  }

  if (!currentQuestion && hasStarted && !savedResult) {
    return (
      <section className="card riasec-card">
        <p className="muted">Chưa có câu hỏi RIASEC để hiển thị.</p>
      </section>
    );
  }

  return (
    <div className="riasec-page">
      <section className="riasec-header">
        <p className="riasec-eyebrow">RIASEC Interest Test</p>
        <h1>Khám phá nhóm sở thích nghề nghiệp</h1>
        <p>
          Chọn mức độ yêu thích với từng hoạt động. Kết quả sẽ gợi ý 3 nhóm
          nổi bật nhất sau khi hoàn thành 30 câu.
        </p>
        <Link className="riasec-info-link" to="/riasec-info">
          RIASEC là gì?
        </Link>
      </section>

      {!shouldShowResult ? (
        <section className="card riasec-card">
          <div className="riasec-progress-meta">
            <span>
              Câu {currentIndex + 1}/{questions.length}
            </span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="riasec-progress">
            <div style={{ width: progressPercent ? `${progressPercent}%` : 18 }} />
          </div>

          <div
            key={currentQuestion.id}
            className="riasec-question-step"
            aria-live="polite"
          >
            <div className="riasec-question">
              <p>
                Câu hỏi {currentIndex + 1}/{questions.length}
              </p>
              <h2>Bạn có thích hoạt động {currentQuestion.text} không?</h2>
            </div>

            <div className="riasec-options">
              {ANSWER_OPTIONS.map((option) => (
                <button
                  key={`${currentQuestion.id}-${option.value}`}
                  type="button"
                  className={[
                    "riasec-scale-option",
                    `scale-${option.value}`,
                    answers[currentQuestion.id] === option.value ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={(event) => handleAnswer(option.value, event)}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="riasec-actions">
            <button
              type="button"
              className="secondary-button riasec-action-back"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
            >
              Câu trước
            </button>
            <button
              type="button"
              className="riasec-action-next"
              onClick={goToNext}
              disabled={answers[currentQuestion.id] === undefined}
            >
              {currentIndex < questions.length - 1 ? "Câu tiếp theo" : "Hoàn thành"}
            </button>
          </div>
        </section>
      ) : (
        <section className="card riasec-card">
          <div className="riasec-result-heading">
            <div>
              <p className="riasec-eyebrow">Kết quả</p>
              <h2>Mã nổi bật: {topResults.map((item) => item.code).join("")}</h2>
              {saveStatus === "saving" && (
                <p className="riasec-save-status">Đang lưu kết quả vào hồ sơ...</p>
              )}
              {saveStatus === "saved" && (
                <p className="riasec-save-status saved">
                  Đã lưu mã RIASEC vào hồ sơ của bạn.
                </p>
              )}
              {saveStatus === "guest" && (
                <p className="riasec-save-status">
                  Đăng nhập để lưu mã RIASEC vào hồ sơ.
                </p>
              )}
              {saveStatus === "error" && (
                <p className="riasec-save-status error-text">
                  Chưa lưu được kết quả. Vui lòng thử lại sau.
                </p>
              )}
            </div>
            <button type="button" onClick={restartTest}>
              Làm lại bài test
            </button>
          </div>

          {topResults[0] && (
            <div className="riasec-primary-result">
              <div>
                <span>Kết quả chính</span>
                <strong>{topResults.map((item) => item.code).join("")}</strong>
              </div>
              <div>
                <h3>
                  Nhóm nổi bật nhất: {topResults[0].code} - {topResults[0].viName}
                </h3>
                <p>{topResults[0].description}</p>
              </div>
            </div>
          )}

          <RiasecRadarChart
            results={displayedResults}
            topResults={topResults}
          />

          <div className="riasec-bars">
            {displayedResults.map((item) => (
              <div className="riasec-bar-row" key={item.type}>
                <div className="riasec-bar-label">
                  <strong>
                    {item.code} - {item.viName}
                  </strong>
                </div>
                <div className="riasec-bar">
                  <div style={{ width: `${item.percent}%` }} />
                </div>
                <span className="riasec-percent">{item.percent}%</span>
              </div>
            ))}
          </div>

          <div className="riasec-top-grid">
            {topResults.map((item, index) => (
              <article key={item.type} className="riasec-top-card">
                <span>Top {index + 1}</span>
                <h3>
                  {item.code} - {item.name}
                </h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          {saveStatus === "saved" && (
            <div className="workflow-result-actions">
              <p>
                Bước tiếp theo giúp hệ thống hiểu rõ hơn về năng lực và cách học
                của bạn.
              </p>
              <Link className="workflow-next-action" to="/discovery/core-quiz">
                Tiếp tục với Core Quiz
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default RiasecTest;
