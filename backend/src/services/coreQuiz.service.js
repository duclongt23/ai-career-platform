const fs = require("fs");
const path = require("path");
const ProfilingQuestion = require("../models/ProfilingQuestion");

const questionsPath = path.resolve(__dirname, "../../../QAprofiling.json");
const use_data_from_mongo = true;

const QUESTION_COUNTS = {
  ability: 6,
  workstyle: 5,
  transferable_skill: 4,
  knowledge: 3,
  essential_skill: 2,
};

const DIFFICULTY_ORDER = {
  easy: 0,
  medium: 1,
  deep: 2,
  hard: 2,
};

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

function orderByDifficultyWithLightShuffle(questions) {
  const grouped = questions.reduce((groups, question) => {
    const difficulty = question.difficulty_level || "medium";
    groups[difficulty] = groups[difficulty] || [];
    groups[difficulty].push(question);
    return groups;
  }, {});

  return Object.keys(grouped)
    .sort(
      (a, b) =>
        (DIFFICULTY_ORDER[a] ?? 99) - (DIFFICULTY_ORDER[b] ?? 99)
    )
    .flatMap((difficulty) => shuffle(grouped[difficulty]));
}

function sanitizeQuestion(question) {
  return {
    question_id: question.question_id,
    target_type: question.target_type,
    question: question.question,
    question_style: question.question_style,
    difficulty_level: question.difficulty_level,
    selection_mode:
      question.selection_mode === "multiple" ? "multi" : question.selection_mode,
    answers: (question.answers || []).map((answer, index) => ({
      index,
      text: answer.text,
    })),
  };
}

async function getCoreQuizQuestions() {
  const questions = await loadQuestionBank();
  const selected = [];
  const selectedIds = new Set();

  Object.entries(QUESTION_COUNTS).forEach(([type, count]) => {
    const candidates = orderByDifficultyWithLightShuffle(
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

  if (selected.length < 20) {
    const fallbackCandidates = orderByDifficultyWithLightShuffle(
      questions.filter((question) => !selectedIds.has(question.question_id))
    );

    fallbackCandidates.slice(0, 20 - selected.length).forEach((question) => {
      selected.push(question);
      selectedIds.add(question.question_id);
    });
  }

  return shuffle(selected).slice(0, 20).map(sanitizeQuestion);
}

function normalizeSelectedIndexes(selectedAnswerIndexes) {
  if (!Array.isArray(selectedAnswerIndexes)) {
    return [];
  }

  return [...new Set(selectedAnswerIndexes)]
    .map((index) => Number(index))
    .filter((index) => Number.isInteger(index) && index >= 0);
}

function getQuestionElementMaximums(question) {
  const maximums = {};

  (question.answers || []).forEach((answer) => {
    Object.entries(answer.mapping || {}).forEach(([code, mapping]) => {
      const score = Number(mapping?.score || 0);

      if (!maximums[code] || score > maximums[code]) {
        maximums[code] = score;
      }
    });
  });

  return maximums;
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
        raw: 0,
        maxPossible: 0,
      });
    }

    return scoreMap.get(code);
  }

  normalizedAnswers.forEach((selectedIndexes, questionId) => {
    const question = questionMap.get(questionId);
    const type = question.target_type;

    Object.entries(getQuestionElementMaximums(question)).forEach(
      ([code, maxScore]) => {
        ensureElementScore(code, type).maxPossible += Number(maxScore || 0);
      }
    );

    selectedIndexes.forEach((answerIndex) => {
      const answer = question.answers?.[answerIndex];

      if (!answer) {
        return;
      }

      Object.entries(answer.mapping || {}).forEach(([code, mapping]) => {
        ensureElementScore(code, type).raw += Number(mapping?.score || 0);
      });
    });
  });

  return [...scoreMap.values()]
    .map((score) => {
      const normalized =
        score.maxPossible > 0 ? Math.min(score.raw / score.maxPossible, 1) : null;

      return {
        code: score.code,
        type: score.type,
        finalScore: normalized,
        scoreBreakdown: {
          coreQuiz: {
            raw: Number(score.raw.toFixed(4)),
            maxPossible: Number(score.maxPossible.toFixed(4)),
            normalized:
              normalized === null ? null : Number(normalized.toFixed(4)),
          },
        },
      };
    })
    .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
}

async function getElementNameMapFromQuestionBank() {
  const questions = await loadQuestionBank();
  const nameMap = new Map();

  questions.forEach((question) => {
    (question.target_elements || []).forEach((element) => {
      if (!element.code) {
        return;
      }

      nameMap.set(element.code, {
        name_vi: element.name_vi || element.code,
        name_en: element.name_en || element.code,
      });
    });
  });

  return nameMap;
}

module.exports = {
  calculateElementScores,
  getElementNameMapFromQuestionBank,
  getCoreQuizQuestions,
  normalizeSelectedIndexes,
};
