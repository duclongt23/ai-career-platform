const express = require("express");
const Element = require("../models/Element");
const ProfilingQuestion = require("../models/ProfilingQuestion");
const StudentProfile = require("../models/StudentProfile");
const { protect, adminOnly } = require("../middleware/auth.middleware");
const {
  ELEMENT_SCORE_ALGORITHM_VERSION,
  calculateProfileElementScores,
} = require("../services/profileElementScore.service");
const {
  normalizeQuestionPayload,
  validateQuestionElements,
} = require("../services/profilingQuestionValidation.service");

const router = express.Router();

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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/elements", protect, adminOnly, async (req, res) => {
  try {
    const targetType = String(req.query.target_type || "").trim();
    const searchText = String(req.query.q || "").trim();

    if (!targetType) {
      return res.status(400).json({
        message: "target_type is required",
      });
    }

    const query = {
      type: targetType,
      is_active: true,
    };

    if (searchText) {
      const searchRegex = new RegExp(escapeRegex(searchText), "i");
      query.$or = [{ code: searchRegex }, { name_vi: searchRegex }];
    }

    const elements = await Element.find(query)
      .select("code name_vi name_en type")
      .sort({ code: 1 })
      .limit(20)
      .lean();

    res.json({ elements });
  } catch (error) {
    res.status(500).json({
      message: "Failed to search elements",
      error: error.message,
    });
  }
});

router.get("/questions", protect, adminOnly, async (req, res) => {
  try {
    const questions = await ProfilingQuestion.find({})
      .sort({ target_type: 1, question_id: 1 })
      .lean();
    const elementNameMap = await getElementNameMap(questions);

    res.json(
      questions.map((question) => serializeQuestion(question, elementNameMap))
    );
  } catch (error) {
    res.status(500).json({
      message: "Failed to load profiling questions",
      error: error.message,
    });
  }
});

router.post("/questions", protect, adminOnly, async (req, res) => {
  try {
    const editablePayload = pickEditableQuestionFields(req.body);
    const payload = normalizeQuestionPayload(editablePayload);
    const question = new ProfilingQuestion(payload);

    await validateQuestionElements(question);
    await question.save();
    const elementNameMap = await getElementNameMap([question]);

    res.status(201).json({
      message: "Profiling question created successfully",
      question: serializeQuestion(question, elementNameMap),
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to create profiling question",
      error: error.message,
    });
  }
});

router.put("/questions/:id", protect, adminOnly, async (req, res) => {
  try {
    const editablePayload = pickEditableQuestionFields(req.body);
    const question = await ProfilingQuestion.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        message: "Profiling question not found",
      });
    }

    const payload = normalizeQuestionPayload(editablePayload, {
      targetType: editablePayload.target_type || question.target_type,
    });
    question.set(payload);
    await validateQuestionElements(question);
    await question.save();
    const elementNameMap = await getElementNameMap([question]);

    res.json({
      message: "Profiling question updated successfully",
      question: serializeQuestion(question, elementNameMap),
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to update profiling question",
      error: error.message,
    });
  }
});

router.delete("/questions/:id", protect, adminOnly, async (req, res) => {
  try {
    const question = await ProfilingQuestion.findById(req.params.id).lean();

    if (!question) {
      return res.status(404).json({
        message: "Profiling question not found",
      });
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

    res.json({
      message: "Profiling question deleted successfully",
      affectedProfiles: affectedProfiles.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete profiling question",
      error: error.message,
    });
  }
});

module.exports = router;
