const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { createHttpError } = require("../utils/httpError");
const { sendPasswordResetEmail } = require("./mail.service");
const {
  hashRefreshToken,
  issueAuthTokens,
  toPublicUser,
} = require("./token.service");

const PASSWORD_RESET_TOKEN_BYTES = 32;
const DEFAULT_PASSWORD_RESET_TTL_MINUTES = 30;
const configuredPasswordResetTtlMinutes = Number(
  process.env.PASSWORD_RESET_TTL_MINUTES
);
const PASSWORD_RESET_TTL_MINUTES =
  Number.isFinite(configuredPasswordResetTtlMinutes) &&
  configuredPasswordResetTtlMinutes > 0
    ? configuredPasswordResetTtlMinutes
    : DEFAULT_PASSWORD_RESET_TTL_MINUTES;
const FORGOT_PASSWORD_RESPONSE =
  "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.";

function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

async function requestPasswordReset({ email }) {
  const user = await User.findOne({ email });

  if (!user || user.is_active === false) {
    return { message: FORGOT_PASSWORD_RESPONSE };
  }

  const resetToken = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
  const resetTokenHash = hashPasswordResetToken(resetToken);

  user.passwordResetTokenHash = resetTokenHash;
  user.passwordResetTokenExpiresAt = new Date(
    Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000
  );
  await user.save();

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetToken,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }

  return { message: FORGOT_PASSWORD_RESPONSE };
}

async function resetPasswordWithToken({ token, password }) {
  const resetTokenHash = hashPasswordResetToken(token);
  const user = await User.findOne({ passwordResetTokenHash: resetTokenHash }).select(
    "+passwordResetTokenHash +passwordResetTokenExpiresAt +refreshTokenHash +refreshTokenExpiresAt"
  );

  if (
    !user ||
    !user.passwordResetTokenExpiresAt ||
    user.passwordResetTokenExpiresAt <= new Date()
  ) {
    throw createHttpError(
      400,
      "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn"
    );
  }

  user.password = await bcrypt.hash(password, 10);
  user.passwordResetTokenHash = null;
  user.passwordResetTokenExpiresAt = null;
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();

  return { message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." };
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
  requestPasswordReset,
  resetPasswordWithToken,
  refreshAuthSession,
  registerStudent,
};
