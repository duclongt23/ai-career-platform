import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const targetTypes = [
  "ability",
  "workstyle",
  "essential_skill",
  "transferable_skill",
  "knowledge",
];

const questionStyles = [
  "behavioral",
  "preference",
  "scenario",
  "reflection",
  "activity_based",
];

const difficultyLevels = ["easy", "medium", "hard"];
const selectionModes = ["single", "multiple"];
const evidenceStrengths = ["weak", "medium", "strong"];
const pageSizeOptions = [3, 5, 10, 20];

const emptyTargetElement = {
  code: "",
  name_vi: "",
  name_en: "",
};

const emptyAnswer = {
  text: "",
  mapping_reason: "",
  mappings: [],
};

const emptyMapping = {
  code: "",
  score: 0.1,
  evidence_strength: "medium",
};

function mappingObjectToRows(mapping) {
  return Object.entries(mapping || {}).map(([code, value]) => ({
    code,
    score: value?.score ?? 0.1,
    evidence_strength: value?.evidence_strength || "medium",
  }));
}

function normalizeQuestion(question) {
  return {
    ...question,
    target_elements: (question.target_elements || []).map((element) => ({
      code: element.code || "",
      name_vi: element.name_vi || "",
      name_en: element.name_en || "",
    })),
    answers: (question.answers || []).map((answer) => ({
      text: answer.text || "",
      mapping_reason: answer.mapping_reason || "",
      mappings: mappingObjectToRows(answer.mapping),
    })),
  };
}

function buildPayload(question) {
  return {
    question_id: question.question_id,
    target_type: question.target_type,
    target_elements: question.target_elements,
    question_style: question.question_style,
    difficulty_level: question.difficulty_level,
    selection_mode: question.selection_mode,
    question_purpose: question.question_purpose,
    question: question.question,
    is_active: Boolean(question.is_active),
    answers: question.answers.map((answer) => ({
      text: answer.text,
      mapping_reason: answer.mapping_reason,
      mapping: answer.mappings.reduce((mapping, row) => {
        const code = String(row.code || "").trim().toLowerCase();

        if (!code) {
          return mapping;
        }

        mapping[code] = {
          score: Number(row.score),
          evidence_strength: row.evidence_strength,
        };

        return mapping;
      }, {}),
    })),
  };
}

function AdminCoreQuiz() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const totalPages = Math.max(1, Math.ceil(questions.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, questions.length);
  const visibleQuestions = questions.slice(pageStart, pageEnd);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/careers");
      return;
    }

    fetchQuestions();
  }, []);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/core-quiz/questions");
      setQuestions(res.data.map(normalizeQuestion));
      setCurrentPage(1);
    } catch (err) {
      setError(
        err.response?.data?.message || "Khong tai duoc danh sach cau hoi."
      );
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (id, updater) => {
    setQuestions((current) =>
      current.map((question) =>
        question._id === id ? updater(question) : question
      )
    );
  };

  const updateQuestionField = (id, field, value) => {
    updateQuestion(id, (question) => ({
      ...question,
      [field]: value,
    }));
  };

  const updateTargetElement = (questionId, elementIndex, field, value) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      target_elements: question.target_elements.map((element, index) =>
        index === elementIndex ? { ...element, [field]: value } : element
      ),
    }));
  };

  const addTargetElement = (questionId) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      target_elements: [...question.target_elements, emptyTargetElement],
    }));
  };

  const removeTargetElement = (questionId, elementIndex) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      target_elements: question.target_elements.filter(
        (_, index) => index !== elementIndex
      ),
    }));
  };

  const updateAnswer = (questionId, answerIndex, field, value) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      answers: question.answers.map((answer, index) =>
        index === answerIndex ? { ...answer, [field]: value } : answer
      ),
    }));
  };

  const addAnswer = (questionId) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      answers: [...question.answers, emptyAnswer],
    }));
  };

  const removeAnswer = (questionId, answerIndex) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      answers: question.answers.filter((_, index) => index !== answerIndex),
    }));
  };

  const updateMapping = (
    questionId,
    answerIndex,
    mappingIndex,
    field,
    value
  ) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      answers: question.answers.map((answer, index) => {
        if (index !== answerIndex) {
          return answer;
        }

        return {
          ...answer,
          mappings: answer.mappings.map((mapping, currentIndex) =>
            currentIndex === mappingIndex
              ? { ...mapping, [field]: value }
              : mapping
          ),
        };
      }),
    }));
  };

  const addMapping = (questionId, answerIndex) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      answers: question.answers.map((answer, index) =>
        index === answerIndex
          ? { ...answer, mappings: [...answer.mappings, emptyMapping] }
          : answer
      ),
    }));
  };

  const removeMapping = (questionId, answerIndex, mappingIndex) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      answers: question.answers.map((answer, index) =>
        index === answerIndex
          ? {
              ...answer,
              mappings: answer.mappings.filter(
                (_, currentIndex) => currentIndex !== mappingIndex
              ),
            }
          : answer
      ),
    }));
  };

  const saveQuestion = async (question) => {
    setMessage("");
    setError("");
    setSavingIds((current) => ({ ...current, [question._id]: true }));

    try {
      const res = await api.put(
        `/admin/core-quiz/questions/${question._id}`,
        buildPayload(question)
      );

      updateQuestion(question._id, () => normalizeQuestion(res.data.question));
      setMessage(`Da luu cau hoi ${res.data.question.question_id}.`);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Luu cau hoi that bai."
      );
    } finally {
      setSavingIds((current) => ({ ...current, [question._id]: false }));
    }
  };

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPaginationControls = () => (
    <div className="admin-pagination">
      <div className="admin-pagination-meta">
        Hien thi {questions.length === 0 ? 0 : pageStart + 1}-{pageEnd} /{" "}
        {questions.length} cau hoi
      </div>

      <div className="admin-pagination-actions">
        <label>
          Moi trang
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="secondary"
          disabled={currentPage === 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          Truoc
        </button>

        <span>
          Trang {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          className="secondary"
          disabled={currentPage === totalPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          Sau
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-core-quiz-page">
      <div className="page-header">
        <h1>Kiem duyet Core Quiz</h1>
        <p>
          Xem va chinh sua cau hoi, dap an, target elements va mapping diem tu
          MongoDB.
        </p>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="admin-core-toolbar">
        <div>
          <strong>{questions.length} cau hoi</strong>
          <p className="muted">Dang xem trang {currentPage}</p>
        </div>

        <div className="admin-core-toolbar-actions">
          <button type="button" className="secondary" onClick={fetchQuestions}>
            Tai lai
          </button>
        </div>
      </div>

      {loading && <div className="card">Dang tai danh sach cau hoi...</div>}

      {!loading && questions.length > 0 && renderPaginationControls()}

      {!loading &&
        visibleQuestions.map((question, visibleQuestionIndex) => (
          <section className="admin-question-card card" key={question._id}>
            <div className="admin-question-heading">
              <div>
                <span>Cau {pageStart + visibleQuestionIndex + 1}</span>
                <h2>{question.question_id}</h2>
              </div>

              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(question.is_active)}
                  onChange={(e) =>
                    updateQuestionField(
                      question._id,
                      "is_active",
                      e.target.checked
                    )
                  }
                />
                Active
              </label>
            </div>

            <div className="admin-core-grid">
              <label>
                Question ID
                <input
                  value={question.question_id}
                  onChange={(e) =>
                    updateQuestionField(
                      question._id,
                      "question_id",
                      e.target.value
                    )
                  }
                />
              </label>

              <label>
                Target type
                <select
                  value={question.target_type}
                  onChange={(e) =>
                    updateQuestionField(
                      question._id,
                      "target_type",
                      e.target.value
                    )
                  }
                >
                  {targetTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Question style
                <select
                  value={question.question_style}
                  onChange={(e) =>
                    updateQuestionField(
                      question._id,
                      "question_style",
                      e.target.value
                    )
                  }
                >
                  {questionStyles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Difficulty
                <select
                  value={question.difficulty_level}
                  onChange={(e) =>
                    updateQuestionField(
                      question._id,
                      "difficulty_level",
                      e.target.value
                    )
                  }
                >
                  {difficultyLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Selection mode
                <select
                  value={question.selection_mode}
                  onChange={(e) =>
                    updateQuestionField(
                      question._id,
                      "selection_mode",
                      e.target.value
                    )
                  }
                >
                  {selectionModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Muc dich cau hoi
              <textarea
                rows="2"
                value={question.question_purpose || ""}
                onChange={(e) =>
                  updateQuestionField(
                    question._id,
                    "question_purpose",
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Noi dung cau hoi
              <textarea
                rows="3"
                value={question.question || ""}
                onChange={(e) =>
                  updateQuestionField(question._id, "question", e.target.value)
                }
              />
            </label>

            <div className="admin-nested-section">
              <div className="admin-section-title">
                <h3>Target elements</h3>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => addTargetElement(question._id)}
                >
                  Them element
                </button>
              </div>

              {question.target_elements.map((element, elementIndex) => (
                <div className="admin-target-row" key={elementIndex}>
                  <input
                    placeholder="code"
                    value={element.code}
                    onChange={(e) =>
                      updateTargetElement(
                        question._id,
                        elementIndex,
                        "code",
                        e.target.value
                      )
                    }
                  />
                  <input
                    placeholder="name_vi"
                    value={element.name_vi}
                    onChange={(e) =>
                      updateTargetElement(
                        question._id,
                        elementIndex,
                        "name_vi",
                        e.target.value
                      )
                    }
                  />
                  <input
                    placeholder="name_en"
                    value={element.name_en}
                    onChange={(e) =>
                      updateTargetElement(
                        question._id,
                        elementIndex,
                        "name_en",
                        e.target.value
                      )
                    }
                  />
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      removeTargetElement(question._id, elementIndex)
                    }
                  >
                    Xoa
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-nested-section">
              <div className="admin-section-title">
                <h3>Dap an va mapping</h3>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => addAnswer(question._id)}
                >
                  Them dap an
                </button>
              </div>

              {question.answers.map((answer, answerIndex) => (
                <div className="admin-answer-block" key={answerIndex}>
                  <div className="admin-answer-heading">
                    <strong>Dap an {answerIndex + 1}</strong>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => removeAnswer(question._id, answerIndex)}
                    >
                      Xoa dap an
                    </button>
                  </div>

                  <label>
                    Noi dung dap an
                    <textarea
                      rows="2"
                      value={answer.text}
                      onChange={(e) =>
                        updateAnswer(
                          question._id,
                          answerIndex,
                          "text",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Ly do mapping
                    <textarea
                      rows="2"
                      value={answer.mapping_reason}
                      onChange={(e) =>
                        updateAnswer(
                          question._id,
                          answerIndex,
                          "mapping_reason",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <div className="admin-mapping-header">
                    <span>Mapping cua dap an</span>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => addMapping(question._id, answerIndex)}
                    >
                      Them mapping
                    </button>
                  </div>

                  {answer.mappings.map((mapping, mappingIndex) => (
                    <div className="admin-mapping-row" key={mappingIndex}>
                      <input
                        placeholder="element code"
                        value={mapping.code}
                        onChange={(e) =>
                          updateMapping(
                            question._id,
                            answerIndex,
                            mappingIndex,
                            "code",
                            e.target.value
                          )
                        }
                      />
                      <input
                        type="number"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={mapping.score}
                        onChange={(e) =>
                          updateMapping(
                            question._id,
                            answerIndex,
                            mappingIndex,
                            "score",
                            e.target.value
                          )
                        }
                      />
                      <select
                        value={mapping.evidence_strength}
                        onChange={(e) =>
                          updateMapping(
                            question._id,
                            answerIndex,
                            mappingIndex,
                            "evidence_strength",
                            e.target.value
                          )
                        }
                      >
                        {evidenceStrengths.map((strength) => (
                          <option key={strength} value={strength}>
                            {strength}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          removeMapping(
                            question._id,
                            answerIndex,
                            mappingIndex
                          )
                        }
                      >
                        Xoa
                      </button>
                    </div>
                  ))}

                  {answer.mappings.length === 0 && (
                    <p className="muted">Dap an nay chua co mapping diem.</p>
                  )}
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button
                type="button"
                disabled={Boolean(savingIds[question._id])}
                onClick={() => saveQuestion(question)}
              >
                {savingIds[question._id] ? "Dang luu..." : "Luu cau hoi"}
              </button>
            </div>
          </section>
        ))}

      {!loading && questions.length > 0 && renderPaginationControls()}
    </div>
  );
}

export default AdminCoreQuiz;
