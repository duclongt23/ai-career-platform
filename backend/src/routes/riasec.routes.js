const express = require("express");
const onetInterest = require("../data/onetInterest.json");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/questions", protect, (req, res) => {
  res.json(onetInterest);
});

module.exports = router;
