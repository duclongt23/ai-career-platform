const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { createHttpError } = require("../utils/httpError");
const {
  hashRefreshToken,
  issueAuthTokens,
  toPublicUser,
} = require("./token.service");

async function createUserWithTokens({ name, email, password, role }) {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw createHttpError(400, "Email đã tồn tại");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
  });
  const tokens = await issueAuthTokens(user);

  return {
    ...tokens,
    user: toPublicUser(user),
  };
}

async function registerStudent({ name, email, password }) {
  return createUserWithTokens({
    name,
    email,
    password,
    role: "student",
  });
}

async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select(
    "+refreshTokenHash +refreshTokenExpiresAt"
  );

  if (!user) {
    throw createHttpError(400, "Email hoặc mật khẩu không đúng");
  }

  if (user.is_active === false) {
    throw createHttpError(403, "Tài khoản của bạn hiện đang tạm ngưng hoạt động.");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw createHttpError(400, "Email hoặc mật khẩu không đúng");
  }

  const tokens = await issueAuthTokens(user);

  return {
    ...tokens,
    user: toPublicUser(user),
  };
}

async function refreshAuthSession(refreshToken) {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const user = await User.findOne({ refreshTokenHash }).select(
    "+refreshTokenHash +refreshTokenExpiresAt"
  );

  if (!user || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt <= new Date()) {
    throw createHttpError(401, "Invalid or expired refresh token");
  }

  if (user.is_active === false) {
    throw createHttpError(403, "Tài khoản của bạn hiện đang tạm ngưng hoạt động.");
  }

  const tokens = await issueAuthTokens(user);

  return {
    ...tokens,
    user: toPublicUser(user),
  };
}

async function logoutAuthSession(refreshToken) {
  await User.updateOne(
    { refreshTokenHash: hashRefreshToken(refreshToken) },
    {
      $set: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    }
  );
}

async function createAdminUser({ name, email, password, providedSetupSecret }) {
  const expectedSecret = process.env.ADMIN_SETUP_SECRET;

  if (!expectedSecret || providedSetupSecret !== expectedSecret) {
    throw createHttpError(403, "Secret thiết lập admin không hợp lệ");
  }

  return createUserWithTokens({
    name,
    email,
    password,
    role: "admin",
  });
}

module.exports = {
  createAdminUser,
  loginUser,
  logoutAuthSession,
  refreshAuthSession,
  registerStudent,
};
