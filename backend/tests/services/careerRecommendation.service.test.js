const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_RECOMMENDATION_LIMIT,
  calculateSimilarity,
  createElementScoresFingerprint,
  rankCareerRecommendations,
} = require("../../src/services/careerRecommendation.service");

test("calculateSimilarity returns a perfect score for identical vectors", () => {
  const weights = new Map([
    ["analysis", 0.8],
    ["communication", 0.4],
  ]);

  assert.deepEqual(calculateSimilarity(weights, weights), {
    score: 1,
    cosine: 1,
    weightedJaccard: 1,
    careerCoverage: 1,
    matchedElementCount: 2,
    topMatchedElements: [
      {
        code: "analysis",
        profileScore: 0.8,
        careerImportance: 0.8,
        contribution: 0.8,
      },
      {
        code: "communication",
        profileScore: 0.4,
        careerImportance: 0.4,
        contribution: 0.4,
      },
    ],
  });
});

test("rankCareerRecommendations ranks stronger matches first and excludes no-overlap careers", () => {
  const recommendations = rankCareerRecommendations({
    elementScores: [
      { code: "analysis", finalScore: 1 },
      { code: "communication", finalScore: 0.5 },
    ],
    careers: [
      {
        onetCode: "strong",
        title_en: "Strong match",
        elements: [
          { code: "analysis", importance: 1 },
          { code: "communication", importance: 0.5 },
        ],
      },
      {
        onetCode: "partial",
        title_en: "Partial match",
        elements: [{ code: "analysis", importance: 0.5 }],
      },
      {
        onetCode: "none",
        title_en: "No overlap",
        elements: [{ code: "design", importance: 1 }],
      },
    ],
  });

  assert.deepEqual(
    recommendations.map((career) => career.onetCode),
    ["strong", "partial"]
  );
  assert.equal(recommendations[0].recommendationScore, 1);
  assert.equal(recommendations[0].matchPercentage, 100);
});

test("rankCareerRecommendations never returns more than the product limit", () => {
  const careers = Array.from({ length: MAX_RECOMMENDATION_LIMIT + 5 }, (_, index) => ({
    onetCode: String(index),
    title_en: `Career ${index}`,
    elements: [{ code: "analysis", importance: 1 }],
  }));

  const recommendations = rankCareerRecommendations({
    elementScores: [{ code: "analysis", finalScore: 1 }],
    careers,
    limit: 100,
  });

  assert.equal(recommendations.length, MAX_RECOMMENDATION_LIMIT);
});

test("createElementScoresFingerprint is stable across element order changes", () => {
  const firstFingerprint = createElementScoresFingerprint([
    { code: "analysis", type: "ability", finalScore: 0.8 },
    { code: "communication", type: "essential_skill", finalScore: 0.6 },
  ]);
  const reorderedFingerprint = createElementScoresFingerprint([
    { code: "communication", type: "essential_skill", finalScore: 0.6 },
    { code: "analysis", type: "ability", finalScore: 0.8 },
  ]);
  const changedFingerprint = createElementScoresFingerprint([
    { code: "analysis", type: "ability", finalScore: 0.9 },
    { code: "communication", type: "essential_skill", finalScore: 0.6 },
  ]);

  assert.equal(firstFingerprint, reorderedFingerprint);
  assert.notEqual(firstFingerprint, changedFingerprint);
});

test("rankCareerRecommendations omits full career elements from cached payloads", () => {
  const [recommendation] = rankCareerRecommendations({
    elementScores: [{ code: "analysis", finalScore: 1 }],
    careers: [
      {
        onetCode: "analysis-career",
        title_en: "Analysis career",
        elements: [{ code: "analysis", importance: 1 }],
      },
    ],
  });

  assert.equal(recommendation.elements, undefined);
  assert.equal(recommendation.topMatchedElements.length, 1);
});
