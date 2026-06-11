const express = require("express");
const riasecController = require("../controllers/riasec.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/questions", protect, riasecController.listQuestions);

module.exports = router;
