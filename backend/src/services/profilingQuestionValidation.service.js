const Element = require("../models/Element");

const ELEMENT_CODE_ALIASES = {
  "ability:armhand_steadiness": "arm_hand_steadiness",
  "ability:wristfinger_speed": "wrist_finger_speed",
  "essential_skill:mathematics": "mathematics_essential_skill",
  "workstyle:selfconfidence": "self_confidence",
  "workstyle:selfcontrol": "self_control",
};

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeElementCode(value, targetType) {
  const code = normalizeCode(value);
  return ELEMENT_CODE_ALIASES[`${targetType}:${code}`] || code;
}

function getMappingEntries(mapping) {
  return mapping instanceof Map
    ? [...mapping.entries()]
    : Object.entries(mapping || {});
}

function normalizeMapping(mapping, targetType) {
  return getMappingEntries(mapping).reduce((normalized, [code, value]) => {
    const normalizedCode = normalizeElementCode(code, targetType);

    if (normalizedCode) {
      normalized[normalizedCode] = value;
    }

    return normalized;
  }, {});
}

function normalizeQuestionPayload(
  payload = {},
  { targetType = payload.target_type } = {}
) {
  const normalized = { ...payload };
  const normalizedTargetType = normalizeCode(targetType);

  if (Object.prototype.hasOwnProperty.call(payload, "target_elements")) {
    normalized.target_elements = (payload.target_elements || []).map((element) => ({
      code: normalizeElementCode(element?.code, normalizedTargetType),
    }));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "answers")) {
    normalized.answers = (payload.answers || []).map((answer) => ({
      ...answer,
      mapping: normalizeMapping(answer?.mapping, normalizedTargetType),
    }));
  }

  return normalized;
}

function validateLocalElementReferences(question) {
  const targetElements = question.target_elements || [];
  const targetCodes = targetElements
    .map((element) => normalizeCode(element.code))
    .filter(Boolean);
  const targetCodeSet = new Set(targetCodes);

  if (targetCodes.length !== targetElements.length) {
    throw new Error("Each target element must include a code.");
  }

  if (targetCodeSet.size !== targetCodes.length) {
    throw new Error("target_elements must not contain duplicate codes.");
  }

  (question.answers || []).forEach((answer, answerIndex) => {
    getMappingEntries(answer.mapping).forEach(([code]) => {
      const normalizedCode = normalizeCode(code);

      if (!targetCodeSet.has(normalizedCode)) {
        throw new Error(
          `answers[${answerIndex}].mapping contains non-target element: ${normalizedCode}`
        );
      }
    });
  });

  return targetCodes;
}

async function validateQuestionElements(question) {
  const targetCodes = validateLocalElementReferences(question);
  const elements = await Element.find({ code: { $in: targetCodes } })
    .select("code type")
    .lean();
  const elementMap = new Map(elements.map((element) => [element.code, element]));
  const missingCodes = targetCodes.filter((code) => !elementMap.has(code));

  if (missingCodes.length > 0) {
    throw new Error(`Unknown target element code(s): ${missingCodes.join(", ")}`);
  }

  const mismatchedCodes = targetCodes.filter(
    (code) => elementMap.get(code).type !== question.target_type
  );

  if (mismatchedCodes.length > 0) {
    throw new Error(
      `Target element type must match target_type ${question.target_type}: ${mismatchedCodes.join(", ")}`
    );
  }
}

module.exports = {
  normalizeQuestionPayload,
  validateQuestionElements,
};
