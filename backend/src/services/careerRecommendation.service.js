const crypto = require("node:crypto");
const {
  DEFAULT_RECOMMENDATION_LIMIT,
  MAX_RECOMMENDATION_LIMIT,
} = require("../constants/recommendations");

const RECOMMENDATION_ALGORITHM_VERSION = 7;
const TOP_MATCHED_ELEMENT_LIMIT = 5;
const TOP_GROWTH_ELEMENT_LIMIT = 8;
const GROWTH_PROFILE_SCORE_MAX = 0.58;
const GROWTH_CAREER_IMPORTANCE_MIN = 0.55;
const GROWTH_GAP_MIN = 0.18;
const TYPE_FIT_COSINE_WEIGHT = 0.65;
const TYPE_FIT_WEIGHTED_JACCARD_WEIGHT = 0.35;
const ELEMENT_FIT_WEIGHT = 0.4;
const RIASEC_FIT_WEIGHT = 0.2;
const STUDENT_TO_CAREER_FIT_WEIGHT = 0.4;
const OUT_OF_CAREER_ELEMENT_PENALTY = 0.3;
const DISPLAY_SCORE_MIN = 55;
const DISPLAY_SCORE_SPREAD = 40;
const DISPLAY_SCORE_EXPONENT = 0.75;

const CAREER_CORE_LIMIT_BY_TYPE = {
  ability: 20,
  workstyle: 15,
  transferable_skill: 10,
  essential_skill: 5,
  knowledge: 10,
};

const ELEMENT_FIT_WEIGHT_BY_TYPE = {
  ability: 0.3,
  workstyle: 0.3,
  transferable_skill: 0.15,
  essential_skill: 0.15,
  knowledge: 0.1,
};

const RIASEC_LETTERS = new Set(["R", "I", "A", "S", "E", "C"]);

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

function createRecommendationProfileFingerprint({
  elementScores = [],
  riasecCode = "",
} = {}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        elementScoresFingerprint: createElementScoresFingerprint(elementScores),
        riasecCode: normalizeRiasecCode(riasecCode),
      })
    )
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

function toCareerCoreElements(elements = []) {
  const elementsByType = new Map();

  elements.forEach((element) => {
    const type = String(element.type || "");
    const limit = CAREER_CORE_LIMIT_BY_TYPE[type];
    const code = normalizeCode(element.code);
    const importance = clamp(Number(element.importance) || 0, 0, 1);

    if (!limit || !code || importance <= 0) {
      return;
    }

    if (!elementsByType.has(type)) {
      elementsByType.set(type, new Map());
    }

    const typedElements = elementsByType.get(type);
    const current = typedElements.get(code);

    if (!current || importance > current.importance) {
      typedElements.set(code, { code, type, importance });
    }
  });

  return Object.keys(CAREER_CORE_LIMIT_BY_TYPE).flatMap((type) => {
    const typedElements = [...(elementsByType.get(type)?.values() || [])];

    return typedElements
      .sort(
        (a, b) => b.importance - a.importance || a.code.localeCompare(b.code)
      )
      .slice(0, CAREER_CORE_LIMIT_BY_TYPE[type]);
  });
}

function toCareerWeightMapsByType(careerCoreElements) {
  const mapsByType = new Map();

  careerCoreElements.forEach((element) => {
    if (!mapsByType.has(element.type)) {
      mapsByType.set(element.type, new Map());
    }

    mapsByType.get(element.type).set(element.code, element.importance);
  });

  return mapsByType;
}

function calculateTypeFit(profileWeights, careerWeights) {
  let dotProduct = 0;
  let profileMagnitudeSquared = 0;
  let careerMagnitudeSquared = 0;
  let intersectionWeight = 0;
  let unionWeight = 0;

  careerWeights.forEach((careerWeight, code) => {
    const profileWeight = profileWeights.get(code) || 0;

    dotProduct += profileWeight * careerWeight;
    profileMagnitudeSquared += profileWeight ** 2;
    careerMagnitudeSquared += careerWeight ** 2;
    intersectionWeight += Math.min(profileWeight, careerWeight);
    unionWeight += Math.max(profileWeight, careerWeight);
  });

  const magnitude = Math.sqrt(profileMagnitudeSquared * careerMagnitudeSquared);
  const cosine = magnitude > 0 ? dotProduct / magnitude : 0;
  const weightedJaccard = unionWeight > 0 ? intersectionWeight / unionWeight : 0;
  const typeFit =
    cosine * TYPE_FIT_COSINE_WEIGHT +
    weightedJaccard * TYPE_FIT_WEIGHTED_JACCARD_WEIGHT;

  return {
    typeFit,
    cosine,
    weightedJaccard,
  };
}

function calculateElementFit(profileWeights, careerCoreElements) {
  const careerMapsByType = toCareerWeightMapsByType(careerCoreElements);
  const typeFits = {};

  const { weightedFit, activeTypeWeight } = Object.entries(
    ELEMENT_FIT_WEIGHT_BY_TYPE
  ).reduce(
    (result, [type, typeWeight]) => {
      const careerWeights = careerMapsByType.get(type) || new Map();
      const fit = calculateTypeFit(profileWeights, careerWeights);
      const hasCareerData = careerWeights.size > 0;

      typeFits[type] = {
        typeFit: roundScore(fit.typeFit),
        cosine: roundScore(fit.cosine),
        weightedJaccard: roundScore(fit.weightedJaccard),
        careerCoreElementCount: careerWeights.size,
        hasCareerData,
      };

      if (hasCareerData) {
        result.weightedFit += fit.typeFit * typeWeight;
        result.activeTypeWeight += typeWeight;
      }

      return result;
    },
    {
      weightedFit: 0,
      activeTypeWeight: 0,
    }
  );
  const elementFit =
    activeTypeWeight > 0 ? weightedFit / activeTypeWeight : 0;

  return {
    elementFit,
    typeFits,
  };
}

function calculateStudentToCareerFit(profileWeights, careerCoreWeights) {
  let weightedUse = 0;
  let matchedProfileWeight = 0;
  let unmatchedProfileWeight = 0;

  profileWeights.forEach((profileWeight, code) => {
    const evidenceWeight = profileWeight ** 2;
    const careerWeight = careerCoreWeights.get(code) || 0;

    if (careerWeight > 0) {
      matchedProfileWeight += evidenceWeight;
      weightedUse += evidenceWeight * careerWeight;
    } else {
      unmatchedProfileWeight += evidenceWeight;
    }
  });

  const denominator =
    matchedProfileWeight +
    OUT_OF_CAREER_ELEMENT_PENALTY * unmatchedProfileWeight;

  return denominator > 0 ? weightedUse / denominator : 0;
}

function normalizeRiasecCode(code) {
  const seen = new Set();

  return String(code || "")
    .toUpperCase()
    .split("")
    .filter((letter) => {
      if (!RIASEC_LETTERS.has(letter) || seen.has(letter)) {
        return false;
      }

      seen.add(letter);
      return true;
    })
    .join("");
}

function toRiasecRankWeights(code) {
  const letters = normalizeRiasecCode(code).split("");
  const length = letters.length;
  const weights = new Map();

  letters.forEach((letter, index) => {
    weights.set(letter, (length - index) / length);
  });

  return weights;
}

function calculateRiasecFit(studentRiasecCode, careerRiasecCode) {
  const studentWeights = toRiasecRankWeights(studentRiasecCode);
  const careerWeights = toRiasecRankWeights(careerRiasecCode);
  const letters = new Set([...studentWeights.keys(), ...careerWeights.keys()]);
  let intersectionWeight = 0;
  let unionWeight = 0;

  letters.forEach((letter) => {
    const studentWeight = studentWeights.get(letter) || 0;
    const careerWeight = careerWeights.get(letter) || 0;

    intersectionWeight += Math.min(studentWeight, careerWeight);
    unionWeight += Math.max(studentWeight, careerWeight);
  });

  return unionWeight > 0 ? intersectionWeight / unionWeight : 0;
}

function calculateMatchedElements(profileWeights, careerCoreElements) {
  return careerCoreElements
    .map((element) => {
      const profileWeight = profileWeights.get(element.code) || 0;
      const contribution = profileWeight * element.importance;

      return {
        code: element.code,
        type: element.type,
        profileScore: roundScore(profileWeight),
        careerImportance: roundScore(element.importance),
        contribution: roundScore(contribution),
      };
    })
    .filter((element) => element.contribution > 0)
    .sort(
      (a, b) =>
        b.contribution - a.contribution ||
        b.careerImportance - a.careerImportance ||
        a.code.localeCompare(b.code)
    );
}

function calculateGrowthElements(profileWeights, careerCoreElements) {
  return careerCoreElements
    .map((element) => {
      const profileScore = profileWeights.get(element.code) || 0;
      const gap = Math.max(element.importance - profileScore, 0);

      return {
        code: element.code,
        type: element.type,
        profileScore: roundScore(profileScore),
        careerImportance: roundScore(element.importance),
        gap: roundScore(gap),
      };
    })
    // Growth areas should be tied to real career demand, not simply the
    // student's lowest scores. This keeps the advice connected to recommended jobs.
    .filter(
      (element) =>
        element.careerImportance >= GROWTH_CAREER_IMPORTANCE_MIN &&
        element.profileScore <= GROWTH_PROFILE_SCORE_MAX &&
        element.gap >= GROWTH_GAP_MIN
    )
    .sort(
      (a, b) =>
        b.gap - a.gap ||
        b.careerImportance - a.careerImportance ||
        a.code.localeCompare(b.code)
    );
}

function calculateCareerCoverage(matchedElements, careerCoreElements) {
  const totalCareerWeight = careerCoreElements.reduce(
    (sum, element) => sum + element.importance,
    0
  );
  const matchedCareerWeight = matchedElements.reduce(
    (sum, element) => sum + element.careerImportance,
    0
  );

  return totalCareerWeight > 0 ? matchedCareerWeight / totalCareerWeight : 0;
}

function calculateSimilarity(profileWeights, careerElements, profile = {}) {
  const careerCoreElements = toCareerCoreElements(careerElements);
  const careerCoreWeights = toWeightMap(careerCoreElements, "importance");
  const { elementFit, typeFits } = calculateElementFit(
    profileWeights,
    careerCoreElements
  );
  const studentToCareerFit = calculateStudentToCareerFit(
    profileWeights,
    careerCoreWeights
  );
  const riasecFit = calculateRiasecFit(
    profile.riasecCode,
    profile.careerRiasecCode
  );
  const matchedElements = calculateMatchedElements(
    profileWeights,
    careerCoreElements
  );
  const growthElements = calculateGrowthElements(
    profileWeights,
    careerCoreElements
  );
  const careerCoverage = calculateCareerCoverage(
    matchedElements,
    careerCoreElements
  );
  const hasRiasecData =
    normalizeRiasecCode(profile.riasecCode).length > 0 &&
    normalizeRiasecCode(profile.careerRiasecCode).length > 0;
  const activeWeightTotal =
    ELEMENT_FIT_WEIGHT +
    STUDENT_TO_CAREER_FIT_WEIGHT +
    (hasRiasecData ? RIASEC_FIT_WEIGHT : 0);
  const weightedScore =
    elementFit * ELEMENT_FIT_WEIGHT +
    studentToCareerFit * STUDENT_TO_CAREER_FIT_WEIGHT +
    (hasRiasecData ? riasecFit * RIASEC_FIT_WEIGHT : 0);
  const rawScoreV3 =
    activeWeightTotal > 0 ? weightedScore / activeWeightTotal : 0;

  return {
    score: roundScore(rawScoreV3),
    rawScoreV3: roundScore(rawScoreV3),
    elementFit: roundScore(elementFit),
    riasecFit: roundScore(riasecFit),
    hasRiasecData,
    studentToCareerFit: roundScore(studentToCareerFit),
    careerCoverage: roundScore(careerCoverage),
    matchedElementCount: matchedElements.length,
    careerCoreElementCount: careerCoreElements.length,
    typeFits,
    topMatchedElements: matchedElements.slice(0, TOP_MATCHED_ELEMENT_LIMIT),
    growthElements: growthElements.slice(0, TOP_GROWTH_ELEMENT_LIMIT),
  };
}

function toRecommendation(career, profileWeights, profile) {
  const { elements, ...careerSummary } = career;
  const similarity = calculateSimilarity(profileWeights, elements, {
    ...profile,
    careerRiasecCode: career.riasecCode,
  });

  return {
    ...careerSummary,
    recommendationScore: similarity.rawScoreV3,
    rawScoreV3: similarity.rawScoreV3,
    matchPercentage: Math.round(similarity.rawScoreV3 * 100),
    similarityBreakdown: {
      elementFit: similarity.elementFit,
      riasecFit: similarity.riasecFit,
      hasRiasecData: similarity.hasRiasecData,
      studentToCareerFit: similarity.studentToCareerFit,
      careerCoverage: similarity.careerCoverage,
      typeFits: similarity.typeFits,
    },
    matchedElementCount: similarity.matchedElementCount,
    careerCoreElementCount: similarity.careerCoreElementCount,
    topMatchedElements: similarity.topMatchedElements,
    growthElements: similarity.growthElements,
  };
}

function getPercentile(value, sortedScores) {
  if (sortedScores.length <= 1) {
    return 1;
  }

  const firstIndex = sortedScores.findIndex((score) => score === value);
  const lastIndex =
    sortedScores.length -
    1 -
    [...sortedScores].reverse().findIndex((score) => score === value);

  return ((firstIndex + lastIndex) / 2) / (sortedScores.length - 1);
}

function applyDisplayScoreCalibration(recommendations) {
  const sortedScores = recommendations
    .map((career) => career.rawScoreV3)
    .sort((a, b) => a - b);

  return recommendations.map((career) => {
    const percentile = getPercentile(career.rawScoreV3, sortedScores);
    const displayMatchScore = Math.round(
      DISPLAY_SCORE_MIN +
        DISPLAY_SCORE_SPREAD * percentile ** DISPLAY_SCORE_EXPONENT
    );

    return {
      ...career,
      displayMatchScore,
      matchPercentage: displayMatchScore,
      displayScoreCalibration: {
        percentile: roundScore(percentile),
      },
    };
  });
}

function rankCareerRecommendations({
  elementScores = [],
  careers = [],
  limit = DEFAULT_RECOMMENDATION_LIMIT,
  profile = {},
} = {}) {
  const profileWeights = toWeightMap(elementScores, "finalScore");
  const normalizedLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || DEFAULT_RECOMMENDATION_LIMIT, 1),
    MAX_RECOMMENDATION_LIMIT
  );
  const rankedRecommendations = careers
    .map((career) => toRecommendation(career, profileWeights, profile))
    .filter((career) => career.matchedElementCount > 0)
    .sort(
      (a, b) =>
        b.rawScoreV3 - a.rawScoreV3 ||
        b.similarityBreakdown.careerCoverage -
          a.similarityBreakdown.careerCoverage ||
        String(a.title_vi || a.title_en).localeCompare(
          String(b.title_vi || b.title_en)
        )
    );

  return applyDisplayScoreCalibration(
    rankedRecommendations.slice(0, normalizedLimit)
  );
}

module.exports = {
  DEFAULT_RECOMMENDATION_LIMIT,
  MAX_RECOMMENDATION_LIMIT,
  RECOMMENDATION_ALGORITHM_VERSION,
  calculateRiasecFit,
  calculateSimilarity,
  createElementScoresFingerprint,
  createRecommendationProfileFingerprint,
  rankCareerRecommendations,
  toCareerCoreElements,
};
