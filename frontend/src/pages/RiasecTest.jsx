import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

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

function RiasecTest() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      navigate("/login", {
        state: {
          message: "Yêu cầu đăng nhập để thực hiện bài test",
          from: "/riasec-test",
        },
      });
      return undefined;
    }

    return undefined;
  }, [navigate, token]);

  const fetchQuestions = () => {
    setIsLoading(true);

    api
      .get("/riasec/questions")
      .then((res) => {
        setError("");
        setQuestions(res.data);
      })
      .catch(() => {
        setError("Không tải được bộ câu hỏi RIASEC. Vui lòng thử lại sau.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const startAssessment = () => {
    setHasStarted(true);
    setAnswers({});
    setCurrentIndex(0);
    setSaveStatus("idle");
    fetchQuestions();
  };

  const answeredCount = Object.keys(answers).length;
  const isCompleted = questions.length > 0 && answeredCount === questions.length;
  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  const results = useMemo(
    () => calculateResults(questions, answers),
    [answers, questions]
  );

  const topResults = results.slice(0, 3);

  const saveRiasecResult = async (nextAnswers) => {
    const token = localStorage.getItem("token");

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
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  const handleAnswer = (value) => {
    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: value,
    };

    setAnswers(nextAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      saveRiasecResult(nextAnswers);
    }
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const restartTest = () => {
    setAnswers({});
    setCurrentIndex(0);
    setSaveStatus("idle");
  };

  if (!hasStarted) {
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

  return (
    <div className="riasec-page">
      <section className="riasec-header">
        <p className="riasec-eyebrow">RIASEC Interest Test</p>
        <h1>Khám phá nhóm sở thích nghề nghiệp</h1>
        <p>
          Chọn mức độ yêu thích với từng hoạt động. Kết quả sẽ gợi ý 3 nhóm
          nổi bật nhất sau khi hoàn thành 30 câu.
        </p>
      </section>

      {!isCompleted ? (
        <section className="card riasec-card">
          <div className="riasec-progress-meta">
            <span>
              Câu {currentIndex + 1}/{questions.length}
            </span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="riasec-progress">
            <div style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="riasec-question">
            <h2>{currentQuestion.text}</h2>
          </div>

          <div className="riasec-options">
            {ANSWER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  answers[currentQuestion.id] === option.value ? "selected" : ""
                }
                onClick={() => handleAnswer(option.value)}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <div className="riasec-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
            >
              Câu trước
            </button>
            <span>{answeredCount} câu đã trả lời</span>
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
              Làm lại
            </button>
          </div>

          <div className="riasec-bars">
            {results.map((item) => (
              <div className="riasec-bar-row" key={item.type}>
                <div className="riasec-bar-label">
                  <strong>
                    {item.code} - {item.viName}
                  </strong>
                  <span>
                    {item.score}/{item.maxScore}
                  </span>
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
        </section>
      )}
    </div>
  );
}

export default RiasecTest;
