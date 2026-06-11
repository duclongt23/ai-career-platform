const express = require("express");
const adminElementController = require("../controllers/adminElement.controller");
const { protect, adminOnly } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", protect, adminOnly, adminElementController.listElements);
router.post("/", protect, adminOnly, adminElementController.createElement);
router.put("/:id", protect, adminOnly, adminElementController.updateElement);
router.delete(
  "/:id",
  protect,
  adminOnly,
  adminElementController.deleteElement
);

module.exports = router;
