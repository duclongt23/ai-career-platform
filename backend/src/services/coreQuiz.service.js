const fs = require("fs");
const path = require("path");
const ProfilingQuestion = require("../models/ProfilingQuestion");

const questionsPath = path.resolve(__dirname, "../../../QAprofiling.json");
const use_data_from_mongo = true;

const QUESTION_COUNTS = {
  ability: 9,
  workstyle: 9,
  transferable_skill: 4,
  knowledge: 5,
  essential_skill: 3,
};
const TOTAL_QUIZ_QUESTIONS = Object.values(QUESTION_COUNTS).reduce(
  (total, count) => total + count,
  0
);

function normalizeQuestionDocument(question) {
  return {
    ...question,
    answers: (question.answers || []).map((answer) => ({
      ...answer,
      mapping:
        answer.mapping instanceof Map
          ? Object.fromEntries(answer.mapping)
          : answer.mapping || {},
    })),
  };
}

function loadQuestionBankFromJson() {
  const raw = fs.readFileSync(questionsPath, "utf8");
  const questions = JSON.parse(raw);

  if (!Array.isArray(questions)) {
    throw new Error("QAprofiling.json must contain a JSON array.");
  }

  return questions.map(normalizeQuestionDocument);
}

async function loadQuestionBankFromMongo() {
  const questions = await ProfilingQuestion.find({ is_active: true })
    .sort({ question_id: 1 })
    .lean();

  if (!Array.isArray(questions)) {
    throw new Error("MongoDB profilingquestions query must return an array.");
  }

  return questions.map(normalizeQuestionDocument);
}

async function loadQuestionBank() {
  if (use_data_from_mongo) {
    return loadQuestionBankFromMongo();
  }

  return loadQuestionBankFromJson();
}

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function sanitizeQuestion(question, { includeAnswerScores = false } = {}) {
  return {
    question_id: question.question_id,
    target_type: question.target_type,
    question: question.question,
    question_style: question.question_style,
    difficulty_level: question.difficulty_level,
    selection_mode:
      question.selection_mode === "multiple" ? "multi" : question.selection_mode,
    answers: (question.answers || []).map((answer, index) => {
      const sanitizedAnswer = {
        index,
        text: answer.text,
      };

      if (includeAnswerScores) {
        sanitizedAnswer.elementScores = Object.entries(answer.mapping || {}).map(
          ([code, mapping]) => ({
            code,
            score: Number(mapping?.score || 0),
          })
        );
      }

      return sanitizedAnswer;
    }),
  };
}

async function getCoreQuizQuestions(options = {}) {
  const questions = await loadQuestionBank();
  const selected = [];
  const selectedIds = new Set();

  Object.entries(QUESTION_COUNTS).forEach(([type, count]) => {
    const candidates = shuffle(
      questions.filter((question) => question.target_type === type)
    );

    candidates.slice(0, count).forEach((question) => {
      if (selectedIds.has(question.question_id)) {
        return;
      }

      selected.push(question);
      selectedIds.add(question.question_id);
    });
  });

  if (selected.length < TOTAL_QUIZ_QUESTIONS) {
    const fallbackCandidates = shuffle(
      questions.filter((question) => !selectedIds.has(question.question_id))
    );

    fallbackCandidates
      .slice(0, TOTAL_QUIZ_QUESTIONS - selected.length)
      .forEach((question) => {
        selected.push(question);
        selectedIds.add(question.question_id);
      });
  }

  return shuffle(selected)
    .slice(0, TOTAL_QUIZ_QUESTIONS)
    .map((question) => sanitizeQuestion(question, options));
}

function normalizeSelectedIndexes(selectedAnswerIndexes) {
  if (!Array.isArray(selectedAnswerIndexes)) {
    return [];
  }

  return [
    ...new Set(
      selectedAnswerIndexes
        .map((index) => Number(index))
        .filter((index) => Number.isInteger(index) && index >= 0)
    ),
  ]
}

async function calculateElementScores(submittedAnswers) {
  const questions = await loadQuestionBank();
  const questionMap = new Map(
    questions.map((question) => [question.question_id, question])
  );

  const normalizedAnswers = new Map();

  submittedAnswers.forEach((answer) => {
    const questionId = String(answer.questionId || "").trim();

    if (!questionId) {
      return;
    }

    normalizedAnswers.set(questionId, normalizeSelectedIndexes(answer.selectedAnswerIndexes));
  });

  const invalidQuestionIds = [...normalizedAnswers.keys()].filter(
    (questionId) => !questionMap.has(questionId)
  );

  if (invalidQuestionIds.length > 0) {
    const error = new Error("One or more questionId values are invalid.");
    error.statusCode = 400;
    error.details = { invalidQuestionIds };
    throw error;
  }

  const invalidAnswerIndexes = [];

  normalizedAnswers.forEach((selectedIndexes, questionId) => {
    const question = questionMap.get(questionId);
    const answerCount = question.answers?.length || 0;

    selectedIndexes.forEach((answerIndex) => {
      if (answerIndex >= answerCount) {
        invalidAnswerIndexes.push({ questionId, answerIndex });
      }
    });
  });

  if (invalidAnswerIndexes.length > 0) {
    const error = new Error("One or more selected answer indexes are invalid.");
    error.statusCode = 400;
    error.details = { invalidAnswerIndexes };
    throw error;
  }

  const scoreMap = new Map();

  function ensureElementScore(code, type) {
    if (!scoreMap.has(code)) {
      scoreMap.set(code, {
        code,
        type,
        rawSum: 0,
        evidenceCount: 0,
      });
    }

    return scoreMap.get(code);
  }

  normalizedAnswers.forEach((selectedIndexes, questionId) => {
    const question = questionMap.get(questionId);
    const type = question.target_type;

    selectedIndexes.forEach((answerIndex) => {
      const answer = question.answers?.[answerIndex];

      if (!answer) {
        return;
      }

      Object.entries(answer.mapping || {}).forEach(([code, mapping]) => {
        const elementScore = ensureElementScore(code, type);
        elementScore.rawSum += Number(mapping?.score || 0);
        elementScore.evidenceCount += 1;
      });
    });
  });

  return [...scoreMap.values()]
    .map((score) => {
      const averageScore = score.rawSum / score.evidenceCount;
      const confidence = Math.min(score.evidenceCount / 10 + 0.5, 1);
      const finalScore = averageScore * confidence;

      return {
        code: score.code,
        type: score.type,
        finalScore: Number(finalScore.toFixed(4)),
        scoreBreakdown: {
          averageScore: Number(averageScore.toFixed(4)),
          confidence: Number(confidence.toFixed(4)),
          evidenceCount: score.evidenceCount,
          rawSum: Number(score.rawSum.toFixed(4)),
        },
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

module.exports = {
  calculateElementScores,
  getCoreQuizQuestions,
  normalizeSelectedIndexes,
};
