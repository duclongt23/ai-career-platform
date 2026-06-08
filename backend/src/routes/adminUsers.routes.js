const express = require("express");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/auth.middleware");

const router = express.Router();
const roles = ["student", "admin"];

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeUser(user) {
  const plainUser =
    typeof user.toObject === "function" ? user.toObject() : user;

  return {
    _id: plainUser._id,
    name: plainUser.name,
    email: plainUser.email,
    role: plainUser.role,
    is_active: plainUser.is_active !== false,
    createdAt: plainUser.createdAt,
    updatedAt: plainUser.updatedAt,
  };
}

function buildUpdatePayload(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    payload.name = String(body.name || "").trim();
  }

  if (roles.includes(body.role)) {
    payload.role = body.role;
  }

  if (Object.prototype.hasOwnProperty.call(body, "is_active")) {
    payload.is_active = Boolean(body.is_active);
  }

  return payload;
}

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 50, 1),
      200
    );
    const filter = {};

    if (roles.includes(role)) {
      filter.role = role;
    }

    if (status === "active") {
      filter.is_active = { $ne: false };
    } else if (status === "inactive") {
      filter.is_active = false;
    }

    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ name: pattern }, { email: pattern }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password -refreshTokenHash -refreshTokenExpiresAt")
        .sort({ createdAt: -1, email: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users: users.map(serializeUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load users",
      error: error.message,
    });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const payload = buildUpdatePayload(req.body);
    const isSelf = String(user._id) === String(req.user._id);

    if (isSelf) {
      delete payload.role;

      if (payload.is_active === false) {
        delete payload.is_active;
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "name") && !payload.name) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    const shouldRevokeRefreshToken =
      Object.prototype.hasOwnProperty.call(payload, "is_active") &&
      payload.is_active === false;

    user.set(payload);

    if (shouldRevokeRefreshToken) {
      user.refreshTokenHash = null;
      user.refreshTokenExpiresAt = null;
    }

    await user.save();

    res.json({
      message: "User updated successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to update user",
      error: error.message,
    });
  }
});

module.exports = router;
