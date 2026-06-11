const express = require("express");
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { authRateLimit } = require("../middleware/rateLimit.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  createAdminSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} = require("../validators/auth.validators");

const router = express.Router();

router.post(
  "/register",
  authRateLimit,
  validate(registerSchema),
  authController.register
);
router.post("/login", authRateLimit, validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", validate(refreshSchema), authController.logout);

router.post(
  "/admin/create",
  authRateLimit,
  validate(createAdminSchema),
  authController.createAdmin
);

router.get("/me", protect, authController.me);

module.exports = router;
