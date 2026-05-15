const mongoose = require("mongoose");

const careerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    field: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    requiredSubjects: {
      type: [String],
      default: [],
    },

    requiredSkills: {
      type: [String],
      default: [],
    },

    suitableInterests: {
      type: [String],
      default: [],
    },

    roadmap: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Career", careerSchema);