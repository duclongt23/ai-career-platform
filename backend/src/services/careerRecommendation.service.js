const crypto = require("node:crypto");

const DEFAULT_RECOMMENDATION_LIMIT = 25;
const MAX_RECOMMENDATION_LIMIT = 25;
const RECOMMENDATION_ALGORITHM_VERSION = 2;
const COSINE_WEIGHT = 0.7;
const WEIGHTED_JACCARD_WEIGHT = 0.3;
const TOP_MATCHED_ELEMENT_LIMIT = 5;

function roundScore(value) {
  return Number(value.toFixed(4));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toLowerCase();
}

function createElementScoresFingerprint(elementScores = []) {
  const normalizedScores = elementScores
    .map((element) => ({
      code: normalizeCode(element.code),
      type: String(element.type || ""),
      finalScore: roundScore(clamp(Number(element.finalScore) || 0, 0, 1)),
    }))
    .filter((element) => element.code)
    .sort(
      (a, b) =>
        a.code.localeCompare(b.code) ||
        a.type.localeCompare(b.type) ||
        a.finalScore - b.finalScore
    );

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalizedScores))
    .digest("hex");
}

function toWeightMap(elements, scoreField) {
  const weights = new Map();

  (elements || []).forEach((element) => {
    const code = normalizeCode(element.code);
    const weight = clamp(Number(element[scoreField]) || 0, 0, 1);

    if (code && weight > (weights.get(code) || 0)) {
      weights.set(code, weight);
    }
  });

  return weights;
}

function calculateSimilarity(profileWeights, careerWeights) {
  const codes = new Set([...profileWeights.keys(), ...careerWeights.keys()]);
  let dotProduct = 0;
  let profileMagnitudeSquared = 0;
  let careerMagnitudeSquared = 0;
  let intersectionWeight = 0;
  let unionWeight = 0;
  let matchedCareerWeight = 0;
  let totalCareerWeight = 0;
  const matchedElements = [];

  codes.forEach((code) => {
    const profileWeight = profileWeights.get(code) || 0;
    const careerWeight = careerWeights.get(code) || 0;
    const contribution = Math.min(profileWeight, careerWeight);

    dotProduct += profileWeight * careerWeight;
    profileMagnitudeSquared += profileWeight ** 2;
    careerMagnitudeSquared += careerWeight ** 2;
    intersectionWeight += contribution;
    unionWeight += Math.max(profileWeight, careerWeight);
    totalCareerWeight += careerWeight;

    if (contribution > 0) {
      matchedCareerWeight += careerWeight;
      matchedElements.push({
        code,
        profileScore: roundScore(profileWeight),
        careerImportance: roundScore(careerWeight),
        contribution: roundScore(contribution),
      });
    }
  });

  const magnitude = Math.sqrt(profileMagnitudeSquared * careerMagnitudeSquared);
  const cosine = magnitude > 0 ? dotProduct / magnitude : 0;
  const weightedJaccard = unionWeight > 0 ? intersectionWeight / unionWeight : 0;
  const careerCoverage =
    totalCareerWeight > 0 ? matchedCareerWeight / totalCareerWeight : 0;
  const score =
    cosine * COSINE_WEIGHT + weightedJaccard * WEIGHTED_JACCARD_WEIGHT;

  return {
    score: roundScore(score),
    cosine: roundScore(cosine),
    weightedJaccard: roundScore(weightedJaccard),
    careerCoverage: roundScore(careerCoverage),
    matchedElementCount: matchedElements.length,
    topMatchedElements: matchedElements
      .sort(
        (a, b) =>
          b.contribution - a.contribution ||
          b.careerImportance - a.careerImportance ||
          a.code.localeCompare(b.code)
      )
      .slice(0, TOP_MATCHED_ELEMENT_LIMIT),
  };
}

function toRecommendation(career, profileWeights) {
  const { elements, ...careerSummary } = career;
  const careerWeights = toWeightMap(elements, "importance");
  const similarity = calculateSimilarity(profileWeights, careerWeights);

  return {
    ...careerSummary,
    recommendationScore: similarity.score,
    matchPercentage: Math.round(similarity.score * 100),
    similarityBreakdown: {
      cosine: similarity.cosine,
      weightedJaccard: similarity.weightedJaccard,
      careerCoverage: similarity.careerCoverage,
    },
    matchedElementCount: similarity.matchedElementCount,
    topMatchedElements: similarity.topMatchedElements,
  };
}

function rankCareerRecommendations({
  elementScores = [],
  careers = [],
  limit = DEFAULT_RECOMMENDATION_LIMIT,
} = {}) {
  const profileWeights = toWeightMap(elementScores, "finalScore");
  const normalizedLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || DEFAULT_RECOMMENDATION_LIMIT, 1),
    MAX_RECOMMENDATION_LIMIT
  );

  return careers
    .map((career) => toRecommendation(career, profileWeights))
    .filter((career) => career.matchedElementCount > 0)
    .sort(
      (a, b) =>
        b.recommendationScore - a.recommendationScore ||
        b.similarityBreakdown.careerCoverage -
          a.similarityBreakdown.careerCoverage ||
        String(a.title_vi || a.title_en).localeCompare(
          String(b.title_vi || b.title_en)
        )
    )
    .slice(0, normalizedLimit);
}

module.exports = {
  DEFAULT_RECOMMENDATION_LIMIT,
  MAX_RECOMMENDATION_LIMIT,
  RECOMMENDATION_ALGORITHM_VERSION,
  calculateSimilarity,
  createElementScoresFingerprint,
  rankCareerRecommendations,
};
