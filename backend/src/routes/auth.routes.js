const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { protect } = require("../middleware/auth.middleware");
const { authRateLimit } = require("../middleware/rateLimit.middleware");
const {
  emailField,
  objectSchema,
  stringField,
  validate,
} = require("../middleware/validate.middleware");
const {
  generateAccessToken,
  hashRefreshToken,
  issueAuthTokens,
  toPublicUser,
} = require("../services/token.service");

const router = express.Router();

const registerSchema = objectSchema({
  name: stringField({ label: "Name", min: 2, max: 80 }),
  email: emailField(),
  password: stringField({ label: "Password", min: 6, max: 128 }),
});

const loginSchema = objectSchema({
  email: emailField(),
  password: stringField({ label: "Password", min: 1, max: 128 }),
});

const refreshSchema = objectSchema({
  refreshToken: stringField({ label: "Refresh token", min: 64, max: 256 }),
});

const createAdminSchema = objectSchema({
  name: stringField({ label: "Name", min: 2, max: 80 }),
  email: emailField(),
  password: stringField({ label: "Password", min: 10, max: 128 }),
  setupSecret: stringField({
    label: "Setup secret",
    required: false,
    min: 16,
    max: 256,
  }),
});

router.post("/register", authRateLimit, validate(registerSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "student",
    });

    const tokens = await issueAuthTokens(user);

    res.status(201).json({
      message: "Register successfully",
      ...tokens,
      user: toPublicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/login", authRateLimit, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select(
      "+refreshTokenHash +refreshTokenExpiresAt"
    );

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const tokens = await issueAuthTokens(user);

    res.json({
      message: "Login successfully",
      ...tokens,
      user: toPublicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/refresh", validate(refreshSchema), async (req, res) => {
  try {
    const refreshTokenHash = hashRefreshToken(req.body.refreshToken);
    const user = await User.findOne({ refreshTokenHash }).select(
      "+refreshTokenHash +refreshTokenExpiresAt"
    );

    if (!user || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt <= new Date()) {
      return res.status(401).json({
        message: "Invalid or expired refresh token",
      });
    }

    const tokens = await issueAuthTokens(user);

    res.json({
      ...tokens,
      user: toPublicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/logout", validate(refreshSchema), async (req, res) => {
  try {
    await User.updateOne(
      { refreshTokenHash: hashRefreshToken(req.body.refreshToken) },
      {
        $set: {
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
        },
      }
    );

    res.json({ message: "Logout successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post(
  "/admin/create",
  authRateLimit,
  validate(createAdminSchema),
  async (req, res) => {
    try {
      const expectedSecret = process.env.ADMIN_SETUP_SECRET;
      const providedSecret =
        req.headers["x-admin-setup-secret"] || req.body.setupSecret;

      if (!expectedSecret || providedSecret !== expectedSecret) {
        return res.status(403).json({
          message: "Invalid admin setup secret",
        });
      }

      const { name, email, password } = req.body;
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(400).json({
          message: "Email already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "admin",
      });
      const tokens = await issueAuthTokens(user);

      res.status(201).json({
        message: "Admin created successfully",
        ...tokens,
        user: toPublicUser(user),
      });
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

router.get("/me", protect, async (req, res) => {
  res.json({
    user: req.user,
  });
});

module.exports = router;    
