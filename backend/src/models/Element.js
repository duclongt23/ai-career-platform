const mongoose = require("mongoose");
const { ELEMENT_TYPES } = require("../constants/elementTypes");

const RIASEC_TYPES = ["R", "I", "A", "S", "E", "C"];

const ElementSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
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

    type: {
      type: String,
      enum: ELEMENT_TYPES,
      required: true,
    },

    description_vi: {
      type: String,
      default: "",
    },

    student_friendly_description: {
      type: String,
      default: "",
    },

    is_active: {
      type: Boolean,
      default: true,
    },

    student_suitable: {
      type: Boolean,
      default: true,
    },

    riasec_tags: {
      type: [
        {
          type: String,
          enum: RIASEC_TYPES,
        },
      ],
      default: [],
      validate: {
        validator(tags) {
          return tags.length <= 3 && new Set(tags).size === tags.length;
        },
        message: "riasec_tags must contain at most 3 unique RIASEC tags.",
      },
    },

    riasec_weights: {
      type: Map,
      of: {
        type: Number,
        min: 0.1,
        max: 1,
      },
      default: {},
      validate: {
        validator(weights) {
          const entries =
            weights instanceof Map ? [...weights.entries()] : Object.entries(weights || {});
          const tags = this.riasec_tags || [];

          return (
            entries.length === tags.length &&
            entries.every(([tag]) => RIASEC_TYPES.includes(tag) && tags.includes(tag))
          );
        },
        message: "riasec_weights keys must match riasec_tags.",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Element", ElementSchema);
