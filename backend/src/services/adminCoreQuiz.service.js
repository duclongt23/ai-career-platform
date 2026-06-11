const Element = require("../models/Element");
const ProfilingQuestion = require("../models/ProfilingQuestion");
const StudentProfile = require("../models/StudentProfile");
const { createHttpError } = require("../utils/httpError");
const { escapeRegExp } = require("../utils/regex");
const {
  ELEMENT_SCORE_ALGORITHM_VERSION,
  calculateProfileElementScores,
} = require("./profileElementScore.service");
const {
  normalizeQuestionPayload,
  validateQuestionElements,
} = require("./profilingQuestionValidation.service");

const editableFields = [
  "question_id",
  "target_type",
  "target_elements",
  "question_style",
  "difficulty_level",
  "selection_mode",
  "question_purpose",
  "question",
  "answers",
  "is_active",
];

function pickEditableQuestionFields(body) {
  return editableFields.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }

    return payload;
  }, {});
}

function getElementCodes(questions) {
  return [
    ...new Set(
      questions.flatMap((question) =>
        (question.target_elements || []).map((element) => element.code)
      )
    ),
  ].filter(Boolean);
}

async function getElementNameMap(questions) {
  const codes = getElementCodes(questions);
  const elements = await Element.find({ code: { $in: codes } })
    .select("code name_vi name_en")
    .lean();

  return new Map(elements.map((element) => [element.code, element]));
}

function serializeQuestion(question, elementNameMap) {
  const plainQuestion =
    typeof question.toObject === "function" ? question.toObject() : question;

  return {
    ...plainQuestion,
    target_elements: (plainQuestion.target_elements || []).map((element) => {
      const canonicalElement = elementNameMap.get(element.code);

      return {
        code: element.code,
        name_vi: canonicalElement?.name_vi || "",
        name_en: canonicalElement?.name_en || "",
      };
    }),
    answers: (plainQuestion.answers || []).map((answer) => ({
      ...answer,
      mapping:
        answer.mapping instanceof Map
          ? Object.fromEntries(answer.mapping)
          : answer.mapping || {},
    })),
  };
}

async function searchQuestionElements({ target_type: targetTypeRaw, q }) {
  const targetType = String(targetTypeRaw || "").trim();
  const searchText = String(q || "").trim();

  if (!targetType) {
    throw createHttpError(400, "target_type is required");
  }

  const query = {
    type: targetType,
    is_active: true,
  };

  if (searchText) {
    const searchRegex = new RegExp(escapeRegExp(searchText), "i");
    query.$or = [{ code: searchRegex }, { name_vi: searchRegex }];
  }

  return Element.find(query)
    .select("code name_vi name_en type")
    .sort({ code: 1 })
    .limit(20)
    .lean();
}

async function listQuestions() {
  const questions = await ProfilingQuestion.find({})
    .sort({ target_type: 1, question_id: 1 })
    .lean();
  const elementNameMap = await getElementNameMap(questions);

  return questions.map((question) => serializeQuestion(question, elementNameMap));
}

async function createQuestion(body) {
  const editablePayload = pickEditableQuestionFields(body);
  const payload = normalizeQuestionPayload(editablePayload);
  const question = new ProfilingQuestion(payload);

  await validateQuestionElements(question);
  await question.save();

  const elementNameMap = await getElementNameMap([question]);
  return serializeQuestion(question, elementNameMap);
}

async function updateQuestion(questionId, body) {
  const editablePayload = pickEditableQuestionFields(body);
  const question = await ProfilingQuestion.findById(questionId);

  if (!question) {
    throw createHttpError(404, "Profiling question not found");
  }

  const payload = normalizeQuestionPayload(editablePayload, {
    targetType: editablePayload.target_type || question.target_type,
  });

  question.set(payload);
  await validateQuestionElements(question);
  await question.save();

  const elementNameMap = await getElementNameMap([question]);
  return serializeQuestion(question, elementNameMap);
}

async function deleteQuestion(questionId) {
  const question = await ProfilingQuestion.findById(questionId).lean();

  if (!question) {
    throw createHttpError(404, "Profiling question not found");
  }

  await ProfilingQuestion.deleteOne({ _id: question._id });

  const affectedProfiles = await StudentProfile.find({
    "coreQuizAnswers.questionId": question.question_id,
  }).select("coreQuizAnswers aiDiscoveries");

  await Promise.all(
    affectedProfiles.map(async (profile) => {
      const coreQuizAnswers = (profile.coreQuizAnswers || []).filter(
        (answer) => answer.questionId !== question.question_id
      );
      const elementScores = await calculateProfileElementScores({
        coreQuizAnswers,
        aiDiscoveries: profile.aiDiscoveries || [],
      });

      profile.coreQuizAnswers = coreQuizAnswers;
      profile.elementScores = elementScores;
      profile.elementScoreVersion = ELEMENT_SCORE_ALGORITHM_VERSION;
      await profile.save();
    })
  );

  return affectedProfiles.length;
}

module.exports = {
  createQuestion,
  deleteQuestion,
  listQuestions,
  searchQuestionElements,
  updateQuestion,
};
