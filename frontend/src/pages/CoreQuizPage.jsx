import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ListChecks, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import AdminCoreQuizAnswerScores from "../components/AdminCoreQuizAnswerScores";
import { DISCOVERY_PROGRESS_UPDATED } from "../components/DiscoveryWorkflowLayout";
import {
  clearDiscoveryDraft,
  getDiscoveryDraftKey,
  readDiscoveryDraft,
  writeDiscoveryDraft,
} from "../utils/discoveryDrafts";
import { getStoredUser } from "../utils/storage";

const TYPE_LABELS = {
  ability: "Năng lực",
  workstyle: "Phong cách làm việc",
  transferable_skill: "Kỹ năng chuyển đổi",
  knowledge: "Kiến thức",
  essential_skill: "Kỹ năng nền tảng",
};

const getElementDisplayName = (score) => score.name_vi || score.code;

const shuffleArray = (items) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};

const shuffleQuestionAnswers = (questionList = []) =>
  questionList.map((question) => ({
    ...question,
    answers: shuffleArray(question.answers || []),
  }));

const CORE_QUIZ_DRAFT_VERSION = 1;

const buildCoreQuizDraft = ({ questions, answers, currentIndex }) => ({
  version: CORE_QUIZ_DRAFT_VERSION,
  currentIndex,
  answers,
  questionOrder: questions.map((question) => question.question_id),
  answerOrderByQuestion: questions.reduce((orders, question) => {
    orders[question.question_id] = (question.answers || []).map(
      (answer) => answer.index
    );
    return orders;
  }, {}),
});

const restoreCoreQuizDraft = (questionList = [], draft) => {
  if (!draft || draft.version !== CORE_QUIZ_DRAFT_VERSION) {
    return {
      questions: shuffleQuestionAnswers(questionList),
      answers: {},
      currentIndex: 0,
    };
  }

  const questionById = new Map(
    questionList.map((question) => [question.question_id, question])
  );
  const draftQuestionOrder = Array.isArray(draft.questionOrder)
    ? draft.questionOrder
    : [];
  const orderedQuestionIds = [
    ...draftQuestionOrder.filter((questionId) => questionById.has(questionId)),
    ...questionList
      .map((question) => question.question_id)
      .filter((questionId) => !draftQuestionOrder.includes(questionId)),
  ];
  const draftAnswerOrders = draft.answerOrderByQuestion || {};
  const orderedQuestions = orderedQuestionIds.map((questionId) => {
    const question = questionById.get(questionId);
    const answerOrder = draftAnswerOrders[questionId] || [];
    const answerByIndex = new Map(
      (question.answers || []).map((answer) => [answer.index, answer])
    );
    const orderedAnswers = [
      ...answerOrder
        .filter((answerIndex) => answerByIndex.has(answerIndex))
        .map((answerIndex) => answerByIndex.get(answerIndex)),
      ...(question.answers || []).filter(
        (answer) => !answerOrder.includes(answer.index)
      ),
    ];

    return {
      ...question,
      answers: orderedAnswers,
    };
  });
  const validQuestionIds = new Set(orderedQuestionIds);
  const validAnswerIndexesByQuestion = new Map(
    orderedQuestions.map((question) => [
      question.question_id,
      new Set((question.answers || []).map((answer) => answer.index)),
    ])
  );
  const restoredAnswers = Object.entries(draft.answers || {}).reduce(
    (nextAnswers, [questionId, answerIndexes]) => {
      if (!validQuestionIds.has(questionId) || !Array.isArray(answerIndexes)) {
        return nextAnswers;
      }

      const validAnswerIndexes = validAnswerIndexesByQuestion.get(questionId);
      const selectedAnswerIndexes = answerIndexes.filter((answerIndex) =>
        validAnswerIndexes.has(answerIndex)
      );

      if (selectedAnswerIndexes.length > 0) {
        nextAnswers[questionId] = selectedAnswerIndexes;
      }

      return nextAnswers;
    },
    {}
  );

  return {
    questions: orderedQuestions,
    answers: restoredAnswers,
    currentIndex: Math.max(
      0,
      Math.min(Number(draft.currentIndex) || 0, orderedQuestions.length - 1)
    ),
  };
};

const formatPercent = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Math.round(Number(value || 0) * 100)}%`;
};

const formatScoreNumber = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toFixed(4).replace(/\.?0+$/, "");
};

function CoreQuizPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const draftKey = getDiscoveryDraftKey("core-quiz", user);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login", {
        state: {
          message: "Yêu cầu đăng nhập để làm bài khám phá bản thân",
          from: "/discovery/core-quiz",
        },
      });
      return undefined;
    }

    let isMounted = true;

    api
      .get("/profile/core-quiz/result")
      .then((res) => {
        if (!isMounted) return;

        setResult(res.data);
        setQuestions([]);
        setHasStarted(false);
        clearDiscoveryDraft(draftKey);
        setError("");
      })
      .catch(async (err) => {
        if (!isMounted) return;

        if (err.response?.status === 404) {
          try {
            const questionsResponse = await api.get("/profile/core-quiz/questions");

            if (!isMounted) return;

            const restoredDraft = restoreCoreQuizDraft(
              questionsResponse.data,
              readDiscoveryDraft(draftKey)
            );

            setQuestions(restoredDraft.questions);
            setAnswers(restoredDraft.answers);
            setCurrentIndex(restoredDraft.currentIndex);
            setError("");
          } catch {
            if (!isMounted) return;

            setError("Không tải được bộ câu hỏi. Vui lòng thử lại sau.");
          }

          return;
        }

        setError("Không tải được bộ câu hỏi. Vui lòng thử lại sau.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [draftKey, navigate, token]);

  useEffect(() => {
    if (!token || result || questions.length === 0) return;

    writeDiscoveryDraft(
      draftKey,
      buildCoreQuizDraft({ questions, answers, currentIndex })
    );
  }, [answers, currentIndex, draftKey, questions, result, token]);

  const currentQuestion = questions[currentIndex];
  const selectedIndexes = currentQuestion
    ? answers[currentQuestion.question_id] || []
    : [];
  const progressPercent = questions.length
    ? Math.round(((currentIndex + 1) / questions.length) * 100)
    : 0;
  const answeredCount = useMemo(
    () =>
      Object.values(answers).filter(
        (answerIndexes) =>
          Array.isArray(answerIndexes) && answerIndexes.length > 0
      ).length,
    [answers]
  );
  const introQuestionCount = questions.length || 30;
  const hasDraftProgress = answeredCount > 0;

  const visibleScores = useMemo(() => result?.elementScores || [], [result]);

  const groupedScores = useMemo(() => {
    return visibleScores.reduce((groups, score) => {
      groups[score.type] = groups[score.type] || [];
      groups[score.type].push(score);
      return groups;
    }, {});
  }, [visibleScores]);

  const topScores = useMemo(() => visibleScores.slice(0, 5), [visibleScores]);

  const isMultiQuestion = (question) =>
    question?.selection_mode === "multi" ||
    question?.selection_mode === "multiple";

  const handleSelectAnswer = (answerIndex) => {
    if (!currentQuestion) return;

    setValidationError("");

    if (!isMultiQuestion(currentQuestion)) {
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.question_id]: [answerIndex],
      }));
      return;
    }

    setAnswers((prev) => {
      const previousIndexes = prev[currentQuestion.question_id] || [];
      const hasAnswer = previousIndexes.includes(answerIndex);
      const nextIndexes = hasAnswer
        ? previousIndexes.filter((index) => index !== answerIndex)
        : [...previousIndexes, answerIndex];

      return {
        ...prev,
        [currentQuestion.question_id]: nextIndexes,
      };
    });
  };

  const canLeaveCurrentQuestion = () => {
    if (selectedIndexes.length > 0) {
      setValidationError("");
      return true;
    }

    setValidationError("Hãy chọn ít nhất một đáp án trước khi tiếp tục.");
    return false;
  };

  const goToPrevious = () => {
    setValidationError("");
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const goToNext = () => {
    if (!canLeaveCurrentQuestion()) return;

    setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
  };

  const startQuiz = () => {
    setHasStarted(true);
    setValidationError("");
  };

  const submitQuiz = async () => {
    if (!canLeaveCurrentQuestion()) return;

    const unansweredQuestion = questions.find(
      (question) => !answers[question.question_id]?.length
    );

    if (unansweredQuestion) {
      setCurrentIndex(questions.indexOf(unansweredQuestion));
      setValidationError(
        `Bạn cần trả lời đủ ${questions.length} câu trước khi hoàn thành.`
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        answers: questions.map((question) => ({
          questionId: question.question_id,
          selectedAnswerIndexes: answers[question.question_id],
        })),
      };
      const res = await api.post("/profile/core-quiz/submit", payload);
      setResult(res.data);
      clearDiscoveryDraft(draftKey);
      window.dispatchEvent(new Event(DISCOVERY_PROGRESS_UPDATED));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Chưa lưu được kết quả. Vui lòng thử lại sau."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const restartQuiz = async () => {
    setIsResetting(true);
    setValidationError("");
    setError("");

    try {
      clearDiscoveryDraft(draftKey);
      await api.delete("/profile/core-quiz/result");
      const res = await api.get("/profile/core-quiz/questions");

      setQuestions(shuffleQuestionAnswers(res.data));
      setAnswers({});
      setCurrentIndex(0);
      setResult(null);
      setHasStarted(false);
      window.dispatchEvent(new Event(DISCOVERY_PROGRESS_UPDATED));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Chưa thể bắt đầu làm lại quiz. Vui lòng thử lại sau."
      );
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="card core-quiz-card">
        <p className="muted">Đang tải bài khám phá bản thân...</p>
      </section>
    );
  }

  if (error && questions.length === 0 && !result) {
    return (
      <section className="card core-quiz-card">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (result) {
    return (
      <div className="core-quiz-page">
        <section className="core-quiz-header">
          <p className="core-quiz-eyebrow">Self-discovery Core Quiz</p>
          <h1>Kết quả khám phá sơ bộ</h1>
          <p>
            Đây là các yếu tố nổi bật từ câu trả lời của bạn. Tên hiển thị hiện
            dùng mã element cho đến khi hệ thống map đầy đủ tên tiếng Việt.
          </p>
        </section>

        <section className="card core-quiz-card">
          <div className="core-result-heading">
            <div>
              <p className="core-quiz-eyebrow">Top element</p>
              <h2>
                {topScores[0]
                  ? getElementDisplayName(topScores[0])
                  : "Chưa có dữ liệu"}
              </h2>
            </div>
            <button type="button" onClick={restartQuiz} disabled={isResetting}>
              Làm lại
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          <div className="core-top-list">
            {topScores.map((score, index) => (
              <article key={score.code} className="core-top-item">
                <span>Top {index + 1}</span>
                <strong>{getElementDisplayName(score)}</strong>
                <em>{TYPE_LABELS[score.type] || score.type}</em>
                <div className="core-score-bar">
                  <div
                    style={{
                      width: `${Math.round((score.finalScore || 0) * 100)}%`,
                    }}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="core-score-groups">
            {Object.entries(groupedScores).map(([type, scores]) => (
              <section key={type}>
                <h3>{TYPE_LABELS[type] || type}</h3>
                <div className="core-score-chip-list">
                  {scores.map((score) => (
                    <span key={score.code}>{getElementDisplayName(score)}</span>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {isAdmin && (
            <section className="core-admin-score-panel">
              <div className="core-admin-score-heading">
                <h3>Admin score details</h3>
                <span>{result.elementScores?.length || 0} elements</span>
              </div>

              <div className="core-admin-score-table-wrapper">
                <table className="core-admin-score-table">
                  <thead>
                    <tr>
                      <th>Element</th>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Final</th>
                      <th>Quiz Score</th>
                      <th>Quiz Evidence</th>
                      <th>Quiz Reliability</th>
                      <th>Quiz Weight</th>
                      <th>AI Score</th>
                      <th>AI Level</th>
                      <th>AI Confidence</th>
                      <th>AI Reliability</th>
                      <th>AI Weight</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(result.elementScores || []).map((score) => {
                      const scoreBreakdown = score.scoreBreakdown || {};

                      return (
                        <tr key={score.code}>
                          <td>{getElementDisplayName(score)}</td>
                          <td>{score.code}</td>
                          <td>{TYPE_LABELS[score.type] || score.type}</td>
                          <td>{formatPercent(score.finalScore)}</td>
                          <td>{formatPercent(scoreBreakdown.quizScore)}</td>
                          <td>
                            {formatScoreNumber(
                              scoreBreakdown.quizEvidenceCount
                            )}
                          </td>
                          <td>
                            {formatPercent(scoreBreakdown.quizReliability)}
                          </td>
                          <td>{formatPercent(scoreBreakdown.quizWeight)}</td>
                          <td>
                            {formatPercent(scoreBreakdown.aiDiscoveryScore)}
                          </td>
                          <td>{scoreBreakdown.aiDiscoveryLevel ?? "-"}</td>
                          <td>
                            {formatPercent(
                              scoreBreakdown.aiDiscoveryConfidence
                            )}
                          </td>
                          <td>
                            {formatPercent(
                              scoreBreakdown.aiDiscoveryReliability
                            )}
                          </td>
                          <td>
                            {formatPercent(scoreBreakdown.aiDiscoveryWeight)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="workflow-result-actions">
            <p>
              Tiếp tục trò chuyện để bổ sung những trải nghiệm mà bài trắc
              nghiệm chưa thể hiện hết.
            </p>
            <Link className="workflow-next-action" to="/discovery/ai-discovery">
              Tiếp tục với AI Discovery
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <section className="card core-quiz-card">
        <p className="muted">Chưa có câu hỏi để hiển thị.</p>
      </section>
    );
  }

  if (!hasStarted) {
    return (
      <div className="core-quiz-page">
        <section className="core-quiz-header">
          <p className="core-quiz-eyebrow">Self-discovery Core Quiz</p>
          <h1>Chào mừng đến bài test Core Quiz</h1>
          <p>
            Bài trắc nghiệm gồm {introQuestionCount} câu hỏi giúp hệ thống nhận
            diện những năng lực, kỹ năng, kiến thức và phong cách làm việc nổi
            bật của bạn.
          </p>
        </section>

        {error && <p className="error">{error}</p>}

        <section className="card core-quiz-card core-quiz-intro-card">
          <div className="core-quiz-intro-grid">
            <div className="core-quiz-intro-copy">
              <p className="core-quiz-eyebrow">Trước khi bắt đầu</p>
              <h2>Trả lời theo đúng cảm nhận của bạn</h2>
              <p>
                Core Quiz không chấm điểm đúng sai. Mỗi câu hỏi chỉ dùng để
                hiểu rõ hơn cách bạn học, xử lý vấn đề và lựa chọn hoạt động
                phù hợp với bản thân.
              </p>
              <ul className="core-quiz-intro-list">
                <li>Đọc kỹ tình huống rồi chọn đáp án gần với bạn nhất.</li>
                <li>Một số câu có thể cho phép chọn nhiều đáp án.</li>
                <li>Bạn có thể quay lại câu trước trong quá trình làm bài.</li>
              </ul>
            </div>

            <aside
              className="core-quiz-intro-facts"
              aria-label="Thông tin bài test Core Quiz"
            >
              <div className="core-quiz-intro-fact">
                <ListChecks size={20} aria-hidden="true" />
                <div>
                  <strong>{introQuestionCount} câu hỏi</strong>
                  <span>Đi lần lượt từng câu để hoàn thành bài test.</span>
                </div>
              </div>
              <div className="core-quiz-intro-fact">
                <CheckCircle2 size={20} aria-hidden="true" />
                <div>
                  <strong>Không có đáp án đúng sai</strong>
                  <span>Ưu tiên lựa chọn thật với trải nghiệm của bạn.</span>
                </div>
              </div>
              <div className="core-quiz-intro-fact">
                <Save size={20} aria-hidden="true" />
                <div>
                  <strong>
                    {hasDraftProgress
                      ? "Có tiến trình đã lưu"
                      : "Tự động lưu tiến trình"}
                  </strong>
                  <span>
                    {hasDraftProgress
                      ? `${answeredCount}/${introQuestionCount} câu đã trả lời`
                      : "Bạn có thể tiếp tục nếu quay lại sau."}
                  </span>
                </div>
              </div>
            </aside>
          </div>

          <div className="core-quiz-intro-actions">
            <button type="button" onClick={startQuiz}>
              {hasDraftProgress ? "Tiếp tục làm bài" : "Bắt đầu làm bài"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <p className="core-quiz-intro-note">
              Kết quả sẽ được dùng để gợi ý nhóm năng lực và lộ trình khám phá
              nghề nghiệp phù hợp hơn.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="core-quiz-page">
      <section className="core-quiz-header">
        <p className="core-quiz-eyebrow">Self-discovery Core Quiz</p>
        <h1>Khám phá điểm mạnh và cách học của bạn</h1>
        <p>
          Trả lời theo cảm nhận thật của bạn. Không có đáp án đúng sai và hệ
          thống sẽ không hiển thị điểm trong lúc làm bài.
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card core-quiz-card">
        <div className="core-progress-meta">
          <span>
            Câu {currentIndex + 1} / {questions.length}
          </span>
          <strong>{progressPercent}%</strong>
        </div>
        <div className="core-progress">
          <div style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="core-question-meta">
          <span>{TYPE_LABELS[currentQuestion.target_type]}</span>
          <span>
            {isMultiQuestion(currentQuestion) ? "Chọn nhiều đáp án" : "Chọn một đáp án"}
          </span>
        </div>

        <div className="core-question">
          <h2>{currentQuestion.question}</h2>
        </div>

        <div className="core-options">
          {currentQuestion.answers.map((answer) => {
            const selected = selectedIndexes.includes(answer.index);
            const inputType = isMultiQuestion(currentQuestion)
              ? "checkbox"
              : "radio";

            return (
              <label key={answer.index} className={selected ? "selected" : ""}>
                <input
                  type={inputType}
                  name={currentQuestion.question_id}
                  checked={selected}
                  onChange={() => handleSelectAnswer(answer.index)}
                />
                <span className="core-option-content">
                  <span>{answer.text}</span>
                  {isAdmin && (
                    <AdminCoreQuizAnswerScores scores={answer.elementScores} />
                  )}
                </span>
              </label>
            );
          })}
        </div>

        {validationError && <p className="field-error">{validationError}</p>}

        <div className="core-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={goToPrevious}
            disabled={currentIndex === 0 || isSubmitting}
          >
            Quay lại
          </button>

          {currentIndex < questions.length - 1 ? (
            <button type="button" onClick={goToNext} disabled={isSubmitting}>
              Tiếp tục
            </button>
          ) : (
            <button type="button" onClick={submitQuiz} disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : "Hoàn thành"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default CoreQuizPage;
