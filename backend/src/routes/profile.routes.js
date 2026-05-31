const express = require("express");
const StudentProfile = require("../models/StudentProfile");
const aiDiscoveryController = require("../controllers/aiDiscovery.controller");
const coreQuizController = require("../controllers/coreQuiz.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

const RIASEC_TYPES = [
  "REALISTIC",
  "INVESTIGATIVE",
  "ARTISTIC",
  "SOCIAL",
  "ENTERPRISING",
  "CONVENTIONAL",
];

router.get("/core-quiz/questions", protect, coreQuizController.getQuestions);
router.get("/core-quiz/result", protect, coreQuizController.getSavedResult);
router.post("/core-quiz/submit", protect, coreQuizController.submitQuiz);
router.delete("/core-quiz/result", protect, coreQuizController.resetQuiz);
router.post("/ai-discovery/start", protect, aiDiscoveryController.startSession);
router.post("/ai-discovery/message", protect, aiDiscoveryController.sendMessage);
router.post("/ai-discovery/reset", protect, aiDiscoveryController.resetSession);
router.post(
  "/ai-discovery/confirm",
  protect,
  aiDiscoveryController.confirmCandidates
);

router.get("/", protect, async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({
      userId: req.user._id,
    });

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const existingProfile = await StudentProfile.findOne({
      userId: req.user._id,
    });

    if (existingProfile) {
      return res.status(400).json({
        message: "Profile already exists",
      });
    }

    const profile = await StudentProfile.create({
      userId: req.user._id,
      grade: req.body.grade,
      favoriteSubjects: req.body.favoriteSubjects || [],
      strongSubjects: req.body.strongSubjects || [],
      goal: req.body.goal || "",
      riasecCode: req.body.riasecCode || "",
      riasecScores: req.body.riasecScores || {},
      riasecCompletedAt: req.body.riasecCompletedAt || null,
    });

    res.status(201).json({
      message: "Profile created successfully",
      profile,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.put("/riasec", protect, async (req, res) => {
  try {
    const { riasecCode, riasecScores } = req.body;
    const code = String(riasecCode || "").toUpperCase();

    if (!/^[RIASEC]{3,6}$/.test(code)) {
      return res.status(400).json({
        message: "Invalid RIASEC code",
      });
    }

    const normalizedScores = RIASEC_TYPES.reduce((scores, type) => {
      scores[type] = Number(riasecScores?.[type] || 0);
      return scores;
    }, {});

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          riasecCode: code,
          riasecScores: normalizedScores,
          riasecCompletedAt: new Date(),
        },
        $setOnInsert: {
          userId: req.user._id,
          grade: 10,
          favoriteSubjects: [],
          strongSubjects: [],
          goal: "",
        },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
      }
    );

    res.json({
      message: "RIASEC result saved successfully",
      profile,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.put("/", protect, async (req, res) => {
  try {
    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        grade: req.body.grade,
        favoriteSubjects: req.body.favoriteSubjects || [],
        strongSubjects: req.body.strongSubjects || [],
        goal: req.body.goal || "",
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
      }
    );

    res.json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
