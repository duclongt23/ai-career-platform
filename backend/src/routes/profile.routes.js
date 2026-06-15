const express = require("express");
const aiDiscoveryController = require("../controllers/aiDiscovery.controller");
const coreQuizController = require("../controllers/coreQuiz.controller");
const profileController = require("../controllers/profile.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/core-quiz/questions", protect, coreQuizController.getQuestions);
router.get("/core-quiz/result", protect, coreQuizController.getSavedResult);
router.post("/core-quiz/submit", protect, coreQuizController.submitQuiz);
router.delete("/core-quiz/result", protect, coreQuizController.resetQuiz);
router.post("/ai-discovery/start", protect, aiDiscoveryController.startSession);
router.post("/ai-discovery/message", protect, aiDiscoveryController.sendMessage);
router.post(
  "/ai-discovery/finalize",
  protect,
  aiDiscoveryController.finalizeSession
);
router.post("/ai-discovery/reset", protect, aiDiscoveryController.resetSession);
router.post(
  "/ai-discovery/more-candidates",
  protect,
  aiDiscoveryController.findMoreCandidates
);
router.post(
  "/ai-discovery/confirm",
  protect,
  aiDiscoveryController.confirmCandidates
);
router.get(
  "/ai-discovery/confirmed-elements",
  protect,
  aiDiscoveryController.listConfirmedElements
);
router.put(
  "/ai-discovery/confirmed-elements",
  protect,
  aiDiscoveryController.updateAllConfirmedElements
);
router.put(
  "/ai-discovery/confirmed",
  protect,
  aiDiscoveryController.updateConfirmedCandidates
);

router.get(
  "/summary-insights",
  protect,
  profileController.getMySummaryInsights
);
router.get("/", protect, profileController.getMyProfile);
router.post("/", protect, profileController.createMyProfile);
router.put("/riasec", protect, profileController.updateMyRiasec);
router.put("/", protect, profileController.updateMyProfile);

module.exports = router;
