const { calculateElementScores } = require("./coreQuiz.service");
const { DEFAULT_AI_CONFIDENCE } = require("../constants/aiDiscovery");

const AI_DISCOVERY_BASE_WEIGHT = 0.75;
const CORE_QUIZ_BASE_WEIGHT = 0.25;
const QUIZ_RELIABILITY_SCALE = 2;
const ELEMENT_SCORE_ALGORITHM_VERSION = 3;

function roundScore(value) {
  return Number(value.toFixed(4));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ensureAccumulator(scoreMap, code, type) {
  const normalizedCode = String(code || "")
    .trim()
    .toLowerCase();

  if (!normalizedCode) {
    return null;
  }

  if (!scoreMap.has(normalizedCode)) {
    scoreMap.set(normalizedCode, {
      code: normalizedCode,
      type,
      quizScore: null,
      quizEvidenceCount: 0,
      aiDiscoveryScore: null,
      aiDiscoveryLevel: null,
      aiDiscoveryConfidence: null,
    });
  }

  return scoreMap.get(normalizedCode);
}

function getLatestAiDiscoveryElements(aiDiscoveries) {
  const latestElementMap = new Map();

  // A repeated AI Discovery session refines the student's profile instead of
  // inflating it. Array order follows creation order, so a later confirmation
  // replaces the older confirmation for the same element code.
  (aiDiscoveries || []).forEach((discovery) => {
    (discovery.confirmedElements || []).forEach((element) => {
      const code = String(element.code || "")
        .trim()
        .toLowerCase();

      if (code) {
        latestElementMap.set(code, element);
      }
    });
  });

  return [...latestElementMap.values()];
}

function addCoreQuizEvidence(scoreMap, quizElementScores) {
  (quizElementScores || []).forEach((score) => {
    const accumulator = ensureAccumulator(scoreMap, score.code, score.type);

    if (!accumulator) {
      return;
    }

    // Core Quiz first aggregates its direct answer mappings into a separate
    // source score. It must not gain dominance merely because the questionnaire
    // happened to contain more questions for the same element.
    accumulator.quizScore = Number(score.scoreBreakdown?.averageScore || 0);
    accumulator.quizEvidenceCount = Number(
      score.scoreBreakdown?.evidenceCount || 0
    );
  });
}

function addAiDiscoveryEvidence(scoreMap, aiDiscoveries) {
  getLatestAiDiscoveryElements(aiDiscoveries).forEach((element) => {
    const level = Number(element.level);

    if (![1, 2, 3].includes(level)) {
      return;
    }

    const accumulator = ensureAccumulator(scoreMap, element.code, element.type);

    if (!accumulator) {
      return;
    }

    // The student's explicit confirmation and level are the primary evidence.
    // AI confidence only fine-tunes reliability in a narrow 0.82..1 range.
    // Legacy snapshots did not store contribution, so they use neutral 0.5.
    const aiConfidence = clamp(
      Number.isFinite(Number(element.contribution))
        ? Number(element.contribution)
        : DEFAULT_AI_CONFIDENCE,
      0.1,
      1
    );

    accumulator.aiDiscoveryScore = level / 3;
    accumulator.aiDiscoveryLevel = level;
    accumulator.aiDiscoveryConfidence = aiConfidence;
  });
}

function finalizeElementScore(score) {
  const hasQuizScore = Number.isFinite(score.quizScore);
  const hasAiDiscoveryScore = Number.isFinite(score.aiDiscoveryScore);
  const quizReliability = hasQuizScore
    ? 1 - Math.exp(-score.quizEvidenceCount / QUIZ_RELIABILITY_SCALE)
    : null;
  const aiDiscoveryReliability = hasAiDiscoveryScore
    ? 0.8 + 0.2 * score.aiDiscoveryConfidence
    : null;
  let quizWeight = 0;
  let aiDiscoveryWeight = 0;
  let finalScore = 0;

  if (hasQuizScore && hasAiDiscoveryScore) {
    // Confirmed AI Discovery is intentionally the primary source. Core Quiz
    // acts as corroborating background evidence and cannot outweigh it.
    quizWeight = CORE_QUIZ_BASE_WEIGHT * quizReliability;
    aiDiscoveryWeight = AI_DISCOVERY_BASE_WEIGHT * aiDiscoveryReliability;
    finalScore =
      (score.quizScore * quizWeight +
        score.aiDiscoveryScore * aiDiscoveryWeight) /
      (quizWeight + aiDiscoveryWeight);
  } else if (hasAiDiscoveryScore) {
    // AI-only elements are discounted by the reliability of the AI evidence.
    // The student's level remains the primary score, while model confidence
    // controls how much of that score is retained.
    aiDiscoveryWeight = aiDiscoveryReliability;
    finalScore = score.aiDiscoveryScore * aiDiscoveryReliability;
  } else if (hasQuizScore) {
    // Quiz-only elements remain useful but are discounted until the amount of
    // questionnaire evidence becomes stable or AI Discovery confirms them.
    quizWeight = quizReliability;
    finalScore = score.quizScore * (0.5 + 0.5 * quizReliability);
  }

  return {
    code: score.code,
    type: score.type,
    finalScore: roundScore(finalScore),
    scoreBreakdown: {
      quizScore: hasQuizScore ? roundScore(score.quizScore) : null,
      quizEvidenceCount: roundScore(score.quizEvidenceCount),
      quizReliability:
        quizReliability === null ? null : roundScore(quizReliability),
      quizWeight: roundScore(quizWeight),
      aiDiscoveryScore: hasAiDiscoveryScore
        ? roundScore(score.aiDiscoveryScore)
        : null,
      aiDiscoveryLevel: score.aiDiscoveryLevel,
      aiDiscoveryConfidence:
        score.aiDiscoveryConfidence === null
          ? null
          : roundScore(score.aiDiscoveryConfidence),
      aiDiscoveryReliability:
        aiDiscoveryReliability === null
          ? null
          : roundScore(aiDiscoveryReliability),
      aiDiscoveryWeight: roundScore(aiDiscoveryWeight),
    },
  };
}

async function calculateProfileElementScores({
  coreQuizAnswers = [],
  aiDiscoveries = [],
} = {}) {
  const scoreMap = new Map();

  // Recalculate from source records every time. This makes submit, reset and
  // repeated confirm requests idempotent and avoids cumulative rounding drift.
  const quizElementScores =
    coreQuizAnswers.length > 0
      ? await calculateElementScores(coreQuizAnswers)
      : [];

  addCoreQuizEvidence(scoreMap, quizElementScores);
  addAiDiscoveryEvidence(scoreMap, aiDiscoveries);

  return [...scoreMap.values()]
    .map(finalizeElementScore)
    .sort((a, b) => b.finalScore - a.finalScore);
}

module.exports = {
  calculateProfileElementScores,
  ELEMENT_SCORE_ALGORITHM_VERSION,
};
