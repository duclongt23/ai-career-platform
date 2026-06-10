const mongoose = require("mongoose");
const { CONFIRM_LEVELS } = require("../constants/aiDiscovery");
const { ELEMENT_TYPES } = require("../constants/elementTypes");

const scoreBreakdownSchema = new mongoose.Schema(
  {
    // Keep source scores separate so the stored snapshot remains explainable
    // and the weighting policy can evolve without reparsing source records.
    quizScore: { type: Number, min: 0, max: 1, default: null },
    quizEvidenceCount: { type: Number, min: 0, default: 0 },
    quizReliability: { type: Number, min: 0, max: 1, default: null },
    quizWeight: { type: Number, min: 0, max: 1, default: 0 },
    aiDiscoveryScore: { type: Number, min: 0, max: 1, default: null },
    aiDiscoveryLevel: { type: Number, min: 1, max: 3, default: null },
    aiDiscoveryConfidence: { type: Number, min: 0, max: 1, default: null },
    aiDiscoveryReliability: { type: Number, min: 0, max: 1, default: null },
    aiDiscoveryWeight: { type: Number, min: 0, max: 1, default: 0 },
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
      enum: ELEMENT_TYPES,
      required: true,
    },

    scoreBreakdown: { type: scoreBreakdownSchema, default: () => ({}) },

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

const confirmedElementSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ELEMENT_TYPES,
      required: true,
    },
    level: {
      type: Number,
      enum: CONFIRM_LEVELS,
      required: true,
    },
    contribution: {
      // Confidence captured from the AI candidate at confirmation time.
      type: Number,
      required: true,
      min: 0.1,
      max: 1,
    },
  },
  { _id: false }
);

const aiDiscoverySchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiDiscoverySession",
      required: true,
    },

    confirmedElements: {
      type: [confirmedElementSchema],
      default: [],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const careerRecommendationSnapshotSchema = new mongoose.Schema(
  {
    algorithmVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    recommendationLimit: {
      type: Number,
      default: 15,
      min: 1,
    },
    elementScoresFingerprint: {
      type: String,
      required: true,
    },
    careerDataFingerprint: {
      type: String,
      required: true,
    },
    recommendations: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const careerFitExplanationSchema = new mongoose.Schema(
  {
    careerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Career",
      required: true,
    },
    strengthCode: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    elementScoresFingerprint: {
      type: String,
      required: true,
    },
    careerUpdatedAt: {
      type: Date,
      required: true,
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const careerDayInLifeSchema = new mongoose.Schema(
  {
    careerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Career",
      required: true,
    },
    careerUpdatedAt: {
      type: Date,
      required: true,
    },
    activities: {
      type: [String],
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const careerExploreChatSourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const careerExploreChatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["assistant", "user"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    sources: {
      type: [careerExploreChatSourceSchema],
      default: [],
    },
    webSearchStatus: {
      type: String,
      default: "",
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const careerExploreChatSessionSchema = new mongoose.Schema(
  {
    careerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Career",
      required: true,
    },
    messages: {
      type: [careerExploreChatMessageSchema],
      default: [],
    },
    suggestedQuestions: {
      type: [String],
      default: [],
    },
    updatedAt: {
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

    // Derived score snapshots can be rebuilt lazily when the algorithm evolves.
    elementScoreVersion: {
      type: Number,
      min: 0,
      default: 0,
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

    // Recommendations are derived from elementScores and can be reused until
    // either the student's scores or the career dataset changes.
    careerRecommendationSnapshot: {
      type: careerRecommendationSnapshotSchema,
      default: null,
    },

    careerFitExplanations: {
      type: [careerFitExplanationSchema],
      default: [],
    },

    careerDayInLifeEntries: {
      type: [careerDayInLifeSchema],
      default: [],
    },

    careerExploreChatSessions: {
      type: [careerExploreChatSessionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
