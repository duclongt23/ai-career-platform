const express = require("express");
const adminCoreQuizController = require("../controllers/adminCoreQuiz.controller");
const { protect, adminOnly } = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
  "/elements",
  protect,
  adminOnly,
  adminCoreQuizController.searchElements
);
router.get(
  "/questions",
  protect,
  adminOnly,
  adminCoreQuizController.listQuestions
);
router.post(
  "/questions",
  protect,
  adminOnly,
  adminCoreQuizController.createQuestion
);
router.put(
  "/questions/:id",
  protect,
  adminOnly,
  adminCoreQuizController.updateQuestion
);
router.delete(
  "/questions/:id",
  protect,
  adminOnly,
  adminCoreQuizController.deleteQuestion
);

module.exports = router;
