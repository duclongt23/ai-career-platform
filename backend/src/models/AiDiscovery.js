const mongoose = require("mongoose");
const {
  CONFIRM_LEVELS,
  MAX_AI_DISCOVERY_MESSAGE_LENGTH,
  MAX_STORED_MESSAGES,
} = require("../constants/aiDiscovery");
const { ELEMENT_TYPES } = require("../constants/elementTypes");

const messageSchema = new mongoose.Schema(
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
      maxlength: MAX_AI_DISCOVERY_MESSAGE_LENGTH,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const candidateElementSchema = new mongoose.Schema(
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
    name_vi: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0.1,
      max: 1,
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
      type: Number,
      required: true,
      min: 0.1,
      max: 1,
    },
  },
  { _id: false }
);

const aiDiscoverySessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    topic: {
      type: String,
      default: "general_self_discovery",
    },

    openingQuestionId: {
      type: String,
      default: "",
      trim: true,
    },

    openingTopic: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["in_progress", "ready_to_confirm", "confirmed", "cancelled"],
      default: "in_progress",
    },

    messages: {
      type: [messageSchema],
      default: [],
      validate: {
        validator(messages) {
          return messages.length <= MAX_STORED_MESSAGES;
        },
        message: `messages must contain at most ${MAX_STORED_MESSAGES} items.`,
      },
    },

    followUpCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalizationReason: {
      type: String,
      enum: ["", "ai_confident", "user_requested"],
      default: "",
    },

    conclusionStatus: {
      type: String,
      enum: ["", "sufficient", "provisional", "insufficient"],
      default: "",
    },

    conclusionConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },

    missingInformation: {
      type: [String],
      default: [],
    },

    canProceedToNextStep: {
      type: Boolean,
      default: false,
    },

    extractedCandidates: {
      type: [candidateElementSchema],
      default: [],
    },

    confirmedElements: {
      type: [confirmedElementSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Tăng tốc truy vấn lấy phiên còn mở gần nhất để tiếp tục cuộc hội thoại.
aiDiscoverySessionSchema.index({ userId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("AiDiscoverySession", aiDiscoverySessionSchema);
