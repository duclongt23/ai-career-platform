const Career = require("../models/Career");
const Element = require("../models/Element");
const StudentProfile = require("../models/StudentProfile");
const {
  buildCareerDayInLifeMessages,
} = require("../prompts/careerDayInLifePrompt");
const {
  buildCareerFitExplanationMessages,
} = require("../prompts/careerFitExplanationPrompt");
const {
  calculateSimilarity,
  createElementScoresFingerprint,
} = require("./careerRecommendation.service");
const {
  findCachedCareerDayInLife,
  MAX_CACHED_DAY_IN_LIFE_ENTRIES,
  parseCareerDayInLife,
} = require("./careerDayInLife.service");
const {
  findCachedCareerFitExplanation,
  MAX_CACHED_EXPLANATIONS,
  parseCareerFitExplanations,
  selectCareerStrength,
} = require("./careerFitExplanation.service");
const { callDeepSeek } = require("./deepseekClient");
const { getCurrentElementScores } = require("./profileElementSnapshot.service");
const { createHttpError } = require("../utils/httpError");

function toWeightMap(elements, scoreField) {
  const weights = new Map();

  (elements || []).forEach((element) => {
    const code = String(element.code || "")
      .trim()
      .toLowerCase();
    const weight = Number(element[scoreField]) || 0;

    if (code && weight > (weights.get(code) || 0)) {
      weights.set(code, weight);
    }
  });

  return weights;
}

async function getCareerFitExplanation({
  userId,
  careerId,
  selectedStrengthCode,
  regenerate,
}) {
  const [profile, career] = await Promise.all([
    StudentProfile.findOne({ userId })
      .select(
        "elementScores elementScoreVersion coreQuizAnswers aiDiscoveries careerFitExplanations"
      )
      .lean(),
    Career.findById(careerId)
      .select("title_en title_vi description_vi elements updatedAt")
      .lean(),
  ]);

  if (!profile) {
    throw createHttpError(404, "Profile not found");
  }

  if (!career) {
    throw createHttpError(404, "Career not found");
  }

  const elementScores = await getCurrentElementScores(profile);
  const similarity = calculateSimilarity(
    toWeightMap(elementScores, "finalScore"),
    career.elements
  );
  const strengthCodes = similarity.topMatchedElements.map(
    (element) => element.code
  );
  const elements = await Element.find({ code: { $in: strengthCodes } })
    .select("code name_vi name_en")
    .lean();
  const elementNameMap = new Map(
    elements.map((element) => [element.code, element])
  );
  const strengths = similarity.topMatchedElements.map((element) => ({
    ...element,
    name_vi: elementNameMap.get(element.code)?.name_vi || element.code,
    name_en: elementNameMap.get(element.code)?.name_en || element.code,
  }));
  const selectedStrength = selectCareerStrength(strengths, selectedStrengthCode);
  const elementScoresFingerprint = createElementScoresFingerprint(elementScores);
  const explanationContext = {
    careerId: career._id,
    elementScoresFingerprint,
    careerUpdatedAt: career.updatedAt,
  };
  const cachedExplanations = Object.fromEntries(
    strengths
      .map((strength) => [
        strength.code,
        findCachedCareerFitExplanation(profile.careerFitExplanations, {
          ...explanationContext,
          strengthCode: strength.code,
        })?.explanation,
      ])
      .filter(([, explanation]) => explanation)
  );
  const strengthsToExplain =
    regenerate === true
      ? strengths
      : strengths.filter((strength) => !cachedExplanations[strength.code]);

  if (!strengthsToExplain.length) {
    return {
      strengths,
      selectedStrengthCode: selectedStrength.code,
      explanations: cachedExplanations,
      cached: true,
    };
  }

  const rawExplanation = await callDeepSeek(
    buildCareerFitExplanationMessages({
      career,
      strengthsToExplain,
    })
  );
  const generatedExplanations = parseCareerFitExplanations(
    rawExplanation,
    strengthsToExplain.map((strength) => strength.code)
  );
  const explanationEntries = Object.entries(generatedExplanations).map(
    ([strengthCode, explanation]) => ({
      careerId: career._id,
      strengthCode,
      elementScoresFingerprint,
      careerUpdatedAt: career.updatedAt,
      explanation,
      generatedAt: new Date(),
    })
  );

  await StudentProfile.updateOne(
    { _id: profile._id },
    {
      $push: {
        careerFitExplanations: {
          $each: explanationEntries,
          $slice: -MAX_CACHED_EXPLANATIONS,
        },
      },
    },
    { runValidators: true }
  );

  return {
    strengths,
    selectedStrengthCode: selectedStrength.code,
    explanations: {
      ...cachedExplanations,
      ...generatedExplanations,
    },
    cached: false,
  };
}

async function getCareerDayInLife({ userId, careerId, regenerate }) {
  const [profile, career] = await Promise.all([
    StudentProfile.findOne({ userId }).select("careerDayInLifeEntries").lean(),
    Career.findById(careerId)
      .select("title_en title_vi description_vi updatedAt")
      .lean(),
  ]);

  if (!profile) {
    throw createHttpError(404, "Profile not found");
  }

  if (!career) {
    throw createHttpError(404, "Career not found");
  }

  const cachedEntry = findCachedCareerDayInLife(
    profile.careerDayInLifeEntries,
    {
      careerId: career._id,
      careerUpdatedAt: career.updatedAt,
    }
  );

  if (cachedEntry && regenerate !== true) {
    return {
      activities: cachedEntry.activities,
      cached: true,
    };
  }

  const rawDayInLife = await callDeepSeek(
    buildCareerDayInLifeMessages({ career })
  );
  const activities = parseCareerDayInLife(rawDayInLife);

  await StudentProfile.updateOne(
    { _id: profile._id },
    {
      $push: {
        careerDayInLifeEntries: {
          $each: [
            {
              careerId: career._id,
              careerUpdatedAt: career.updatedAt,
              activities,
              generatedAt: new Date(),
            },
          ],
          $slice: -MAX_CACHED_DAY_IN_LIFE_ENTRIES,
        },
      },
    },
    { runValidators: true }
  );

  return {
    activities,
    cached: false,
  };
}

module.exports = {
  getCareerDayInLife,
  getCareerFitExplanation,
};
