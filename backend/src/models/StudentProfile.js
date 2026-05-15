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
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);