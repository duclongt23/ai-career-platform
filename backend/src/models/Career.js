const mongoose = require("mongoose");
const {
  isValidCareerCluster,
  normalizeCareerClusters,
} = require("../utils/careerCluster");

const careerElementSchema = new mongoose.Schema(
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

    importance: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
  },
  { _id: false }
);

const careerSchema = new mongoose.Schema(
  {
    onetCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    title_en: {
      type: String,
      required: true,
      trim: true,
    },

    title_vi: {
      type: String,
      default: "",
      trim: true,
    },

    aliases: {
      type: [String],
      default: [],
    },


    description_vi: {
      type: String,
      default: "",
    },

    careerCluster: {
      type: [String],
      default: [],
      set: normalizeCareerClusters,
      validate: {
        validator(clusters) {
          return normalizeCareerClusters(clusters).every(isValidCareerCluster);
        },
        message: "careerCluster must use one of the configured career cluster values.",
      },
    },

    riasecCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: "",
      maxlength: 6,
      match: /^$|^[RIASEC]{1,6}$/,
    },

    vietnam_relevance: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },

    is_active: {
      type: Boolean,
      default: true,
    },

    student_suitable: {
      type: Boolean,
      default: true,
    },

    elements: {
      type: [careerElementSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Career", careerSchema);
