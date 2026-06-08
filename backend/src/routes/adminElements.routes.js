const express = require("express");
const Career = require("../models/Career");
const Element = require("../models/Element");
const ProfilingQuestion = require("../models/ProfilingQuestion");
const { ELEMENT_TYPES } = require("../constants/elementTypes");
const { protect, adminOnly } = require("../middleware/auth.middleware");

const router = express.Router();
const RIASEC_TYPES = ["R", "I", "A", "S", "E", "C"];
const editableFields = [
  "name_vi",
  "name_en",
  "type",
  "description_vi",
  "student_friendly_description",
  "is_active",
  "student_suitable",
  "riasec_tags",
  "riasec_weights",
];

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickEditableFields(body) {
  return editableFields.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }

    return payload;
  }, {});
}

function normalizeTags(tags) {
  return [
    ...new Set(
      (Array.isArray(tags) ? tags : [])
        .map((tag) => String(tag || "").trim().toUpperCase())
        .filter((tag) => RIASEC_TYPES.includes(tag))
    ),
  ].slice(0, 3);
}

function normalizeWeights(weights, tags) {
  const source =
    weights instanceof Map ? Object.fromEntries(weights) : weights || {};

  return tags.reduce((normalized, tag) => {
    const value = Number(source[tag]);

    normalized[tag] = Number.isFinite(value)
      ? Math.min(Math.max(value, 0.1), 1)
      : 0.5;

    return normalized;
  }, {});
}

function normalizePayload(body, { includeCode = false } = {}) {
  const payload = includeCode ? { code: body.code, ...pickEditableFields(body) } : pickEditableFields(body);

  if (includeCode) {
    payload.code = String(payload.code || "").trim().toLowerCase();
  }

  if (payload.type) {
    payload.type = String(payload.type).trim();
  }

  if (!ELEMENT_TYPES.includes(payload.type)) {
    delete payload.type;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "riasec_tags")) {
    payload.riasec_tags = normalizeTags(payload.riasec_tags);
    payload.riasec_weights = normalizeWeights(
      payload.riasec_weights,
      payload.riasec_tags
    );
  } else if (Object.prototype.hasOwnProperty.call(payload, "riasec_weights")) {
    delete payload.riasec_weights;
  }

  return payload;
}

function serializeElement(element) {
  const plainElement =
    typeof element.toObject === "function" ? element.toObject() : element;

  return {
    ...plainElement,
    riasec_weights:
      plainElement.riasec_weights instanceof Map
        ? Object.fromEntries(plainElement.riasec_weights)
        : plainElement.riasec_weights || {},
  };
}

async function getReferenceCounts(code) {
  const [careerCount, questionCount] = await Promise.all([
    Career.countDocuments({ "elements.code": code }),
    ProfilingQuestion.countDocuments({ "target_elements.code": code }),
  ]);

  return { careerCount, questionCount };
}

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const { search, type, status } = req.query;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 50, 1),
      200
    );
    const filter = {};

    if (type && ELEMENT_TYPES.includes(type)) {
      filter.type = type;
    }

    if (status === "active") {
      filter.is_active = true;
    } else if (status === "inactive") {
      filter.is_active = false;
    } else if (status === "student_suitable") {
      filter.student_suitable = true;
    }

    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ code: pattern }, { name_vi: pattern }, { name_en: pattern }];
    }

    const [elements, total] = await Promise.all([
      Element.find(filter)
        .sort({ type: 1, code: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Element.countDocuments(filter),
    ]);

    res.json({
      elements: elements.map(serializeElement),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load elements",
      error: error.message,
    });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const payload = normalizePayload(req.body, { includeCode: true });
    const element = await Element.create(payload);

    res.status(201).json({
      message: "Element created successfully",
      element: serializeElement(element),
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to create element",
      error: error.message,
    });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const element = await Element.findById(req.params.id);

    if (!element) {
      return res.status(404).json({
        message: "Element not found",
      });
    }

    const payload = normalizePayload(req.body);

    if (payload.type && payload.type !== element.type) {
      const references = await getReferenceCounts(element.code);

      if (references.questionCount > 0) {
        return res.status(409).json({
          message: "Cannot change type while element is used by Core Quiz",
          references,
        });
      }
    }

    element.set(payload);
    await element.save();

    res.json({
      message: "Element updated successfully",
      element: serializeElement(element),
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to update element",
      error: error.message,
    });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const element = await Element.findById(req.params.id);

    if (!element) {
      return res.status(404).json({
        message: "Element not found",
      });
    }

    const references = await getReferenceCounts(element.code);

    if (references.careerCount > 0 || references.questionCount > 0) {
      return res.status(409).json({
        message:
          "Cannot delete element while it is referenced. Set it inactive instead.",
        references,
      });
    }

    await Element.deleteOne({ _id: element._id });

    res.json({
      message: "Element deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete element",
      error: error.message,
    });
  }
});

module.exports = router;
