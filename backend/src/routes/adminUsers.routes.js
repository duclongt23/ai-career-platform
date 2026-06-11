const express = require("express");
const adminUserController = require("../controllers/adminUser.controller");
const { protect, adminOnly } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", protect, adminOnly, adminUserController.listUsers);
router.put("/:id", protect, adminOnly, adminUserController.updateUser);

module.exports = router;
