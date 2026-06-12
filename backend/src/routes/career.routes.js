const express = require("express");
const careerController = require("../controllers/career.controller");
const {
  deleteCareerExploreChatSession,
  exploreCareerChat,
  listCareerExploreChats,
  submitCareerExploreChatFeedback,
  updateCareerExploreChatTitle,
} = require("../controllers/careerExploreChat.controller");
const { protect, adminOnly } = require("../middleware/auth.middleware");
const {
  careerExploreChatRateLimit,
} = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.get("/recommendations/me", protect, careerController.listRecommendations);
router.post(
  "/:id/fit-explanation",
  protect,
  careerController.createFitExplanation
);
router.post("/:id/day-in-life", protect, careerController.createDayInLife);
router.post("/:id/roadmap", protect, careerController.createRoadmap);
router.post(
  "/:id/explore-chat",
  protect,
  careerExploreChatRateLimit,
  exploreCareerChat
);
router.get("/explore-chats/me", protect, listCareerExploreChats);
router.patch(
  "/:id/explore-chat/session",
  protect,
  updateCareerExploreChatTitle
);
router.delete(
  "/:id/explore-chat/session",
  protect,
  deleteCareerExploreChatSession
);
router.post(
  "/:id/explore-chat/feedback",
  protect,
  submitCareerExploreChatFeedback
);

router.get(
  "/admin/elements",
  protect,
  adminOnly,
  careerController.searchAdminElements
);
router.get("/admin", protect, adminOnly, careerController.listAdmin);

router.get("/", careerController.listPublic);
router.get("/:id", careerController.getById);
router.post("/", protect, adminOnly, careerController.createCareer);
router.put("/:id", protect, adminOnly, careerController.updateCareer);
router.delete("/:id", protect, adminOnly, careerController.deleteCareer);

module.exports = router;
