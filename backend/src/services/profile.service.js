const StudentProfile = require("../models/StudentProfile");
const { createHttpError } = require("../utils/httpError");

const RIASEC_TYPES = [
  "REALISTIC",
  "INVESTIGATIVE",
  "ARTISTIC",
  "SOCIAL",
  "ENTERPRISING",
  "CONVENTIONAL",
];

async function getProfile(userId) {
  const profile = await StudentProfile.findOne({ userId });

  if (!profile) {
    throw createHttpError(404, "Profile not found");
  }

  return profile;
}

async function createProfile(userId, body) {
  const existingProfile = await StudentProfile.findOne({ userId });

  if (existingProfile) {
    throw createHttpError(400, "Profile already exists");
  }

  return StudentProfile.create({
    userId,
    grade: body.grade,
    favoriteSubjects: body.favoriteSubjects || [],
    strongSubjects: body.strongSubjects || [],
    goal: body.goal || "",
    riasecCode: body.riasecCode || "",
    riasecScores: body.riasecScores || {},
    riasecCompletedAt: body.riasecCompletedAt || null,
  });
}

function normalizeRiasecScores(riasecScores) {
  return RIASEC_TYPES.reduce((scores, type) => {
    scores[type] = Number(riasecScores?.[type] || 0);
    return scores;
  }, {});
}

async function updateRiasecResult(userId, { riasecCode, riasecScores }) {
  const code = String(riasecCode || "").toUpperCase();

  if (!/^[RIASEC]{3,6}$/.test(code)) {
    throw createHttpError(400, "Invalid RIASEC code");
  }

  return StudentProfile.findOneAndUpdate(
    { userId },
    {
      $set: {
        riasecCode: code,
        riasecScores: normalizeRiasecScores(riasecScores),
        riasecCompletedAt: new Date(),
      },
      $setOnInsert: {
        userId,
        grade: 10,
        favoriteSubjects: [],
        strongSubjects: [],
        goal: "",
      },
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    }
  );
}

async function updateProfile(userId, body) {
  return StudentProfile.findOneAndUpdate(
    { userId },
    {
      grade: body.grade,
      favoriteSubjects: body.favoriteSubjects || [],
      strongSubjects: body.strongSubjects || [],
      goal: body.goal || "",
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    }
  );
}

module.exports = {
  createProfile,
  getProfile,
  updateProfile,
  updateRiasecResult,
};
