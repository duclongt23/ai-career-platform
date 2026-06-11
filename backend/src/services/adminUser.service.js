const User = require("../models/User");
const { escapeRegExp } = require("../utils/regex");
const { createHttpError } = require("../utils/httpError");

const USER_ROLES = ["student", "admin"];

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

  if (USER_ROLES.includes(body.role)) {
    payload.role = body.role;
  }

  if (Object.prototype.hasOwnProperty.call(body, "is_active")) {
    payload.is_active = Boolean(body.is_active);
  }

  return payload;
}

async function listUsers({ search, role, status, page: rawPage, limit: rawLimit }) {
  const page = Math.max(Number.parseInt(rawPage, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(rawLimit, 10) || 50, 1),
    200
  );
  const filter = {};

  if (USER_ROLES.includes(role)) {
    filter.role = role;
  }

  if (status === "active") {
    filter.is_active = { $ne: false };
  } else if (status === "inactive") {
    filter.is_active = false;
  }

  if (search) {
    const pattern = { $regex: escapeRegExp(search), $options: "i" };
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

  return {
    users: users.map(serializeUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function updateUser(userId, body, currentUserId) {
  const user = await User.findById(userId);

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const payload = buildUpdatePayload(body);
  const isSelf = String(user._id) === String(currentUserId);

  if (isSelf) {
    delete payload.role;

    if (payload.is_active === false) {
      delete payload.is_active;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "name") && !payload.name) {
    throw createHttpError(400, "Name is required");
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

  return serializeUser(user);
}

module.exports = {
  listUsers,
  updateUser,
};
