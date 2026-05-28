const mongoose = require("mongoose");

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
      enum: ["ability", "workstyle", "essential_skill", "knowledge", "transferable_skill"],
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Element", ElementSchema);
