const StudentProfile = require("../models/StudentProfile");
const Element = require("../models/Element");
const {
  getCoreQuizQuestions,
  normalizeSelectedIndexes,
} = require("../services/coreQuiz.service");
const {
  calculateProfileElementScores,
  ELEMENT_SCORE_ALGORITHM_VERSION,
} = require("../services/profileElementScore.service");

const getQuestions = async (req, res) => {
  try {
    res.json(
      await getCoreQuizQuestions({
        includeAnswerScores: req.user.role === "admin",
      })
    );
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
      .select(
        "elementScores elementScoreVersion coreQuizAnswers aiDiscoveries coreQuizCompletedAt"
      )
      .lean();

    if (!profile?.coreQuizCompletedAt) {
      return res.status(404).json({
        message: "Core quiz result not found",
      });
    }

    let elementScores = profile.elementScores;

    if (profile.elementScoreVersion !== ELEMENT_SCORE_ALGORITHM_VERSION) {
      // Lazily migrate stored snapshots when scoring rules evolve. Source
      // records are canonical; elementScores is only a derived cache.
      elementScores = await calculateProfileElementScores({
        coreQuizAnswers: profile.coreQuizAnswers,
        aiDiscoveries: profile.aiDiscoveries,
      });
      await StudentProfile.updateOne(
        { userId: req.user._id },
        {
          $set: {
            elementScores,
            elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
          },
        },
        {
          runValidators: true,
        }
      );
    }
    const responseElementScores = await enrichElementScoresWithNames(
      elementScores
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
    const names = elementNameMap.get(score.code);

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

    // elementScores is a profile-wide snapshot. Rebuild it from the submitted
    // quiz answers and previous AI confirmations so neither source is lost.
    const existingProfile = await StudentProfile.findOne({
      userId: req.user._id,
    })
      .select("aiDiscoveries")
      .lean();
    const elementScores = await calculateProfileElementScores({
      coreQuizAnswers,
      aiDiscoveries: existingProfile?.aiDiscoveries || [],
    });
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
          elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
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
    const existingProfile = await StudentProfile.findOne({
      userId: req.user._id,
    })
      .select("aiDiscoveries")
      .lean();

    // Reset removes only Core Quiz evidence. Confirmed AI Discovery evidence
    // remains part of the profile because it came from a separate workflow.
    const elementScores = await calculateProfileElementScores({
      aiDiscoveries: existingProfile?.aiDiscoveries || [],
    });

    await StudentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          coreQuizAnswers: [],
          elementScores,
          elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
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
