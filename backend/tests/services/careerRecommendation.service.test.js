const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_RECOMMENDATION_LIMIT,
  calculateRiasecFit,
  calculateSimilarity,
  createElementScoresFingerprint,
  rankCareerRecommendations,
  toCareerCoreElements,
} = require("../../src/services/careerRecommendation.service");

const completeProfileScores = [
  { code: "analysis", type: "ability", finalScore: 1 },
  { code: "persistence", type: "workstyle", finalScore: 1 },
  { code: "communication", type: "transferable_skill", finalScore: 1 },
  { code: "reading", type: "essential_skill", finalScore: 1 },
  { code: "math", type: "knowledge", finalScore: 1 },
];

const completeCareerElements = [
  { code: "analysis", type: "ability", importance: 1 },
  { code: "persistence", type: "workstyle", importance: 1 },
  { code: "communication", type: "transferable_skill", importance: 1 },
  { code: "reading", type: "essential_skill", importance: 1 },
  { code: "math", type: "knowledge", importance: 1 },
];

function toProfileWeights(elementScores) {
  return new Map(
    elementScores.map((element) => [element.code, element.finalScore])
  );
}

test("toCareerCoreElements keeps the top-K elements for each type", () => {
  const abilityElements = Array.from({ length: 25 }, (_, index) => ({
    code: `ability-${index}`,
    type: "ability",
    importance: 1 - index * 0.01,
  }));
  const coreElements = toCareerCoreElements([
    ...abilityElements,
    { code: "workstyle-1", type: "workstyle", importance: 0.5 },
  ]);

  assert.equal(
    coreElements.filter((element) => element.type === "ability").length,
    20
  );
  assert.equal(
    coreElements.some((element) => element.code === "ability-20"),
    false
  );
  assert.equal(
    coreElements.some((element) => element.code === "workstyle-1"),
    true
  );
});

test("calculateSimilarity returns full raw score for identical element and RIASEC vectors", () => {
  const similarity = calculateSimilarity(
    toProfileWeights(completeProfileScores),
    completeCareerElements,
    { riasecCode: "RIA", careerRiasecCode: "RIA" }
  );

  assert.equal(similarity.rawScoreV3, 1);
  assert.equal(similarity.elementFit, 1);
  assert.equal(similarity.riasecFit, 1);
  assert.equal(similarity.studentToCareerFit, 1);
  assert.equal(similarity.matchedElementCount, 5);
});

test("calculateRiasecFit uses weighted intersection of Holland codes", () => {
  assert.equal(calculateRiasecFit("RIA", "RIA"), 1);
  assert.equal(calculateRiasecFit("RIA", "SEC"), 0);
  assert.equal(calculateRiasecFit("RIA", "IRS") > 0, true);
});

test("rankCareerRecommendations ranks by raw score, excludes no-overlap careers, and calibrates display scores", () => {
  const recommendations = rankCareerRecommendations({
    elementScores: completeProfileScores,
    profile: { riasecCode: "RIA" },
    careers: [
      {
        onetCode: "strong",
        title_en: "Strong match",
        riasecCode: "RIA",
        elements: completeCareerElements,
      },
      {
        onetCode: "partial",
        title_en: "Partial match",
        riasecCode: "RIA",
        elements: completeCareerElements.slice(0, 2),
      },
      {
        onetCode: "none",
        title_en: "No overlap",
        riasecCode: "RIA",
        elements: [{ code: "design", type: "ability", importance: 1 }],
      },
    ],
  });

  assert.deepEqual(
    recommendations.map((career) => career.onetCode),
    ["strong", "partial"]
  );
  assert.equal(recommendations[0].rawScoreV3, 1);
  assert.equal(recommendations[0].recommendationScore, 1);
  assert.equal(recommendations[0].displayMatchScore, 95);
  assert.equal(recommendations[0].matchPercentage, 95);
  assert.equal(recommendations[1].displayMatchScore, 55);
});

test("rankCareerRecommendations never returns more than the product limit", () => {
  const careers = Array.from({ length: MAX_RECOMMENDATION_LIMIT + 5 }, (_, index) => ({
    onetCode: String(index),
    title_en: `Career ${index}`,
    riasecCode: "RIA",
    elements: [{ code: "analysis", type: "ability", importance: 1 }],
  }));

  const recommendations = rankCareerRecommendations({
    elementScores: completeProfileScores,
    profile: { riasecCode: "RIA" },
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
    elementScores: completeProfileScores,
    profile: { riasecCode: "RIA" },
    careers: [
      {
        onetCode: "analysis-career",
        title_en: "Analysis career",
        riasecCode: "RIA",
        elements: completeCareerElements,
      },
    ],
  });

  assert.equal(recommendation.elements, undefined);
  assert.equal(recommendation.topMatchedElements.length, 5);
  assert.equal(Number.isFinite(recommendation.displayMatchScore), true);
});
