const StudentProfile = require("../models/StudentProfile");
const Element = require("../models/Element");
const {
  calculateElementScores,
  getElementNameMapFromQuestionBank,
  getCoreQuizQuestions,
  normalizeSelectedIndexes,
} = require("../services/coreQuiz.service");

const getQuestions = async (req, res) => {
  try {
    res.json(await getCoreQuizQuestions());
  } catch (error) {
    res.status(500).json({
      message: "Failed to load core quiz questions",
      error: error.message,
    });
  }
};

const getSavedResult = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user._id })
      .select("elementScores coreQuizCompletedAt")
      .lean();

    if (
      !profile?.coreQuizCompletedAt ||
      !Array.isArray(profile.elementScores) ||
      profile.elementScores.length === 0
    ) {
      return res.status(404).json({
        message: "Core quiz result not found",
      });
    }

    const responseElementScores = await enrichElementScoresWithNames(
      profile.elementScores
    );

    res.json({
      message: "Core quiz result loaded successfully",
      elementScores: responseElementScores,
      coreQuizCompletedAt: profile.coreQuizCompletedAt,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load core quiz result",
      error: error.message,
    });
  }
};

const enrichElementScoresWithNames = async (elementScores) => {
  const fallbackNameMap = await getElementNameMapFromQuestionBank();
  const codes = elementScores.map((score) => score.code);
  const elements = await Element.find({ code: { $in: codes } })
    .select("code name_vi name_en")
    .lean();
  const elementNameMap = new Map(
    elements.map((element) => [
      element.code,
      {
        name_vi: element.name_vi,
        name_en: element.name_en,
      },
    ])
  );

  return elementScores.map((score) => {
    const names = elementNameMap.get(score.code) || fallbackNameMap.get(score.code);

    return {
      ...score,
      name_vi: names?.name_vi || score.code,
      name_en: names?.name_en || score.code,
    };
  });
};

const submitQuiz = async (req, res) => {
  try {
    const { answers, grade } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        message: "answers must be a non-empty array",
      });
    }

    const coreQuizAnswers = answers.map((answer) => ({
      questionId: String(answer.questionId || "").trim(),
      selectedAnswerIndexes: normalizeSelectedIndexes(answer.selectedAnswerIndexes),
      answeredAt: new Date(),
    }));

    const invalidAnswer = coreQuizAnswers.find(
      (answer) =>
        !answer.questionId || answer.selectedAnswerIndexes.length === 0
    );

    if (invalidAnswer) {
      return res.status(400).json({
        message:
          "Each answer must include questionId and at least one selectedAnswerIndexes item",
      });
    }

    const elementScores = await calculateElementScores(answers);
    const responseElementScores = await enrichElementScoresWithNames(elementScores);
    const profileGrade = [10, 11, 12].includes(Number(grade))
      ? Number(grade)
      : 12;

    await StudentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          coreQuizAnswers,
          elementScores,
          coreQuizCompletedAt: new Date(),
        },
        $setOnInsert: {
          userId: req.user._id,
          grade: profileGrade,
        },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
      }
    );

    res.json({
      message: "Core quiz submitted successfully",
      elementScores: responseElementScores,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to submit core quiz",
      error: error.message,
      details: error.details,
    });
  }
};

const resetQuiz = async (req, res) => {
  try {
    await StudentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          coreQuizAnswers: [],
          elementScores: [],
          coreQuizCompletedAt: null,
        },
      },
      {
        runValidators: true,
      }
    );

    res.json({
      message: "Core quiz result reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to reset core quiz result",
      error: error.message,
    });
  }
};

module.exports = {
  getQuestions,
  getSavedResult,
  resetQuiz,
  submitQuiz,
};
