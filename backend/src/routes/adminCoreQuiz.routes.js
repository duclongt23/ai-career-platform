const express = require("express");
const ProfilingQuestion = require("../models/ProfilingQuestion");
const { protect, adminOnly } = require("../middleware/auth.middleware");

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

function serializeQuestion(question) {
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

router.get("/questions", protect, adminOnly, async (req, res) => {
  try {
    const questions = await ProfilingQuestion.find({})
      .sort({ target_type: 1, question_id: 1 })
      .lean();

    res.json(questions.map(serializeQuestion));
  } catch (error) {
    res.status(500).json({
      message: "Failed to load profiling questions",
      error: error.message,
    });
  }
});

router.put("/questions/:id", protect, adminOnly, async (req, res) => {
  try {
    const payload = pickEditableQuestionFields(req.body);

    const question = await ProfilingQuestion.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!question) {
      return res.status(404).json({
        message: "Profiling question not found",
      });
    }

    res.json({
      message: "Profiling question updated successfully",
      question: serializeQuestion(question),
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to update profiling question",
      error: error.message,
    });
  }
});

module.exports = router;
