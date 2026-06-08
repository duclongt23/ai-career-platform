const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;

function generateAccessToken(userId) {
  return jwt.sign({ id: userId, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getRefreshTokenExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

async function issueAuthTokens(user) {
  const refreshToken = generateRefreshToken();

  user.refreshTokenHash = hashRefreshToken(refreshToken);
  user.refreshTokenExpiresAt = getRefreshTokenExpiry();
  await user.save();

  return {
    token: generateAccessToken(user._id),
    refreshToken,
    refreshTokenExpiresAt: user.refreshTokenExpiresAt,
  };
}

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active !== false,
  };
}

module.exports = {
  generateAccessToken,
  hashRefreshToken,
  issueAuthTokens,
  toPublicUser,
};
