const mongoose = require("mongoose");

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

    interests: {
      type: [String],
      default: [],
    },

    skills: {
      type: [String],
      default: [],
    },

    goal: {
      type: String,
      default: "",
    },

    riasecCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: "",
      maxlength: 6,
    },

    riasecScores: {
      REALISTIC: {
        type: Number,
        default: 0,
      },
      INVESTIGATIVE: {
        type: Number,
        default: 0,
      },
      ARTISTIC: {
        type: Number,
        default: 0,
      },
      SOCIAL: {
        type: Number,
        default: 0,
      },
      ENTERPRISING: {
        type: Number,
        default: 0,
      },
      CONVENTIONAL: {
        type: Number,
        default: 0,
      },
    },

    riasecCompletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
