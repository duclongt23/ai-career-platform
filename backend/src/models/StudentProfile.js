const mongoose = require("mongoose");

const scorePartSchema = new mongoose.Schema(
  {
    raw: { type: Number, default: 0 },
    maxPossible: { type: Number, default: 0 },
    normalized: { type: Number, min: 0, max: 1, default: null },
  },
  { _id: false }
);

const elementScoreSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "ability",
        "workstyle",
        "essential_skill",
        "transferable_skill",
        "knowledge",
      ],
      required: true,
    },

    scoreBreakdown: {
      coreQuiz: { type: scorePartSchema, default: () => ({}) },
      aiDiscovery: { type: scorePartSchema, default: () => ({}) },
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
  },
  { _id: false }
);

const coreQuizAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
    },

    selectedAnswerIndexes: {
      type: [Number],
      default: [],
    },

    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const aiDiscoverySchema = new mongoose.Schema(
  {
    question: { type: String, default: "" },
    userAnswer: { type: String, default: "" },

    suggestedElements: [
      {
        code: String,
        type: String,
        reason: String,
      },
    ],

    confirmedElements: [
      {
        code: String,
        type: String,
        level: {
          type: Number, // 0-3
          min: 0,
          max: 3,
        },
      },
    ],

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    grade: {
      type: Number,
      enum: [10, 11, 12],
      required: true,
    },

    favoriteSubjects: {
      type: [String],
      default: [],
    },

    strongSubjects: {
      type: [String],
      default: [],
    },

    goal: {
      type: String,
      default: "",
      trim: true,
    },

    riasecCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: "",
      maxlength: 6,
    },

    riasecScores: {
      REALISTIC: { type: Number, default: 0 },
      INVESTIGATIVE: { type: Number, default: 0 },
      ARTISTIC: { type: Number, default: 0 },
      SOCIAL: { type: Number, default: 0 },
      ENTERPRISING: { type: Number, default: 0 },
      CONVENTIONAL: { type: Number, default: 0 },
    },

    riasecCompletedAt: {
      type: Date,
      default: null,
    },

    coreQuizAnswers: {
      type: [coreQuizAnswerSchema],
      default: [],
    },

    elementScores: {
      type: [elementScoreSchema],
      default: [],
    },

    aiDiscoveries: {
      type: [aiDiscoverySchema],
      default: [],
    },

    coreQuizCompletedAt: {
      type: Date,
      default: null,
    },

    profileCompletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);