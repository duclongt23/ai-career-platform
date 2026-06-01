const MAX_EXPLANATION_LENGTH = 1200;
const MAX_CACHED_EXPLANATIONS = 100;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseJsonObject(rawResponse) {
  const trimmedResponse = String(rawResponse || "").trim();

  try {
    return JSON.parse(trimmedResponse);
  } catch {
    const withoutCodeFence = trimmedResponse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const firstBraceIndex = withoutCodeFence.indexOf("{");
    const lastBraceIndex = withoutCodeFence.lastIndexOf("}");

    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      try {
        return JSON.parse(
          withoutCodeFence.slice(firstBraceIndex, lastBraceIndex + 1)
        );
      } catch {
        // Báo lỗi rõ ràng phía dưới thay vì tự đoán nội dung model trả về.
      }
    }

    throw new Error("DeepSeek returned invalid career fit explanation JSON");
  }
}

function parseCareerFitExplanations(rawResponse, expectedStrengthCodes) {
  const response = parseJsonObject(rawResponse);
  const expectedCodes = new Set(expectedStrengthCodes);
  const explanations = Array.isArray(response.explanations)
    ? response.explanations
    : [];
  const parsedExplanations = new Map();

  explanations.forEach((item) => {
    const strengthCode =
      typeof item.strengthCode === "string"
        ? item.strengthCode.trim().toLowerCase()
        : "";
    const explanation =
      typeof item.explanation === "string" ? item.explanation.trim() : "";

    if (
      !expectedCodes.has(strengthCode) ||
      !explanation ||
      explanation.length > MAX_EXPLANATION_LENGTH ||
      parsedExplanations.has(strengthCode)
    ) {
      throw new Error("DeepSeek returned an invalid career fit explanation");
    }

    parsedExplanations.set(strengthCode, explanation);
  });

  if (parsedExplanations.size !== expectedCodes.size) {
    throw new Error("DeepSeek did not return all career fit explanations");
  }

  return Object.fromEntries(parsedExplanations);
}

function selectCareerStrength(strengths, requestedCode) {
  if (!strengths.length) {
    throw createHttpError(409, "No matched strengths found for this career");
  }

  if (!requestedCode) {
    return strengths[0];
  }

  const normalizedCode = String(requestedCode).trim().toLowerCase();
  const selectedStrength = strengths.find(
    (strength) => strength.code === normalizedCode
  );

  if (!selectedStrength) {
    throw createHttpError(400, "selectedStrengthCode must be a matched strength");
  }

  return selectedStrength;
}

function findCachedCareerFitExplanation(
  explanations,
  { careerId, strengthCode, elementScoresFingerprint, careerUpdatedAt }
) {
  const normalizedCareerId = String(careerId);
  const normalizedCareerUpdatedAt = new Date(careerUpdatedAt).getTime();

  return [...(explanations || [])].reverse().find(
    (explanation) =>
      String(explanation.careerId) === normalizedCareerId &&
      explanation.strengthCode === strengthCode &&
      explanation.elementScoresFingerprint === elementScoresFingerprint &&
      new Date(explanation.careerUpdatedAt).getTime() ===
        normalizedCareerUpdatedAt
  );
}

module.exports = {
  findCachedCareerFitExplanation,
  MAX_CACHED_EXPLANATIONS,
  parseCareerFitExplanations,
  selectCareerStrength,
};
