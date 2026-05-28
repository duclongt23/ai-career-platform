const mongoose = require("mongoose");

const TARGET_TYPES = ["ability", "workstyle", "essential_skill", "transferable_skill", "knowledge"];
const QUESTION_STYLES = ["behavioral", "preference", "scenario", "reflection", "activity_based"];
const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];
const SELECTION_MODES = ["single", "multiple"];
const EVIDENCE_STRENGTHS = ["weak", "medium", "strong"];

const targetElementSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    name_vi: {
      type: String,
      required: true,
      trim: true,
    },

    name_en: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const answerMappingSchema = new mongoose.Schema(
  {
    score: {
      type: Number,
      required: true,
      min: 0.1,
      max: 1,
    },

    evidence_strength: {
      type: String,
      enum: EVIDENCE_STRENGTHS,
      required: true,
    },
  },
  { _id: false }
);

const answerSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },

    mapping: {
      type: Map,
      of: answerMappingSchema,
      default: {},
    },

    mapping_reason: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const profilingQuestionSchema = new mongoose.Schema(
  {
    question_id: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    target_type: {
      type: String,
      enum: TARGET_TYPES,
      required: true,
    },

    target_elements: {
      type: [targetElementSchema],
      validate: {
        validator(elements) {
          return elements.length >= 1 && elements.length <= 4;
        },
        message: "target_elements must contain 1 to 4 elements.",
      },
      required: true,
    },

    question_style: {
      type: String,
      enum: QUESTION_STYLES,
      required: true,
    },

    difficulty_level: {
      type: String,
      enum: DIFFICULTY_LEVELS,
      required: true,
    },

    selection_mode: {
      type: String,
      enum: SELECTION_MODES,
      required: true,
    },

    question_purpose: {
      type: String,
      required: true,
      trim: true,
    },

    question: {
      type: String,
      required: true,
      trim: true,
    },

    answers: {
      type: [answerSchema],
      validate: {
        validator(answers) {
          return answers.length >= 4 && answers.length <= 6;
        },
        message: "answers must contain 4 to 6 options.",
      },
      required: true,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

profilingQuestionSchema.index({ target_type: 1, is_active: 1 });
profilingQuestionSchema.index({ "target_elements.code": 1 });

module.exports = mongoose.model("ProfilingQuestion", profilingQuestionSchema);
