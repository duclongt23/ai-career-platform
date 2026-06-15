const Career = require("../models/Career");
const Element = require("../models/Element");
const StudentProfile = require("../models/StudentProfile");
const {
  DEFAULT_RECOMMENDATION_LIMIT,
  RECOMMENDATION_ALGORITHM_VERSION,
  createElementScoresFingerprint,
  createRecommendationProfileFingerprint,
  rankCareerRecommendations,
} = require("./careerRecommendation.service");
const {
  ELEMENT_SCORE_ALGORITHM_VERSION,
} = require("./profileElementScore.service");
const { getCurrentElementScores } = require("./profileElementSnapshot.service");
const { RECOMMENDABLE_CAREER_FILTER } = require("./career.service");
const { createHttpError } = require("../utils/httpError");

async function addElementNamesToRecommendations(recommendations) {
  const elementCodes = [
    ...new Set(
      recommendations.flatMap((career) => [
        ...(career.topMatchedElements || []).map((element) => element.code),
        ...(career.growthElements || []).map((element) => element.code),
      ])
    ),
  ].filter(Boolean);

  if (!elementCodes.length) {
    return recommendations;
  }

  const elements = await Element.find({ code: { $in: elementCodes } })
    .select("code name_vi name_en")
    .lean();
  const elementNameMap = new Map(
    elements.map((element) => [element.code, element])
  );
  const attachName = (element) => {
    const namedElement = elementNameMap.get(element.code);

    return {
      ...element,
      name_vi: namedElement?.name_vi || "",
      name_en: namedElement?.name_en || "",
    };
  };

  return recommendations.map((career) => ({
    ...career,
    topMatchedElements: (career.topMatchedElements || []).map(attachName),
    growthElements: (career.growthElements || []).map(attachName),
  }));
}

async function getCareerDataFingerprint() {
  const [careerCount, latestCareer] = await Promise.all([
    Career.countDocuments(RECOMMENDABLE_CAREER_FILTER),
    Career.findOne(RECOMMENDABLE_CAREER_FILTER)
      .select("_id updatedAt")
      .sort({ updatedAt: -1, _id: -1 })
      .lean(),
  ]);

  return [
    careerCount,
    latestCareer?._id || "none",
    latestCareer?.updatedAt?.getTime() || 0,
  ].join(":");
}

async function getCareerRecommendationsForUser(userId) {
  const profile = await StudentProfile.findOne({ userId })
    .select(
      "elementScores elementScoreVersion coreQuizAnswers aiDiscoveries riasecCode careerRecommendationSnapshot"
    )
    .lean();

  if (!profile) {
    throw createHttpError(404, "Profile not found");
  }

  const elementScores = await getCurrentElementScores(profile);

  if (!elementScores?.some((element) => element.finalScore > 0)) {
    throw createHttpError(
      409,
      "Complete the profiling steps before requesting recommendations"
    );
  }

  const elementScoresFingerprint = createElementScoresFingerprint(elementScores);
  const profileRecommendationFingerprint = createRecommendationProfileFingerprint({
    elementScores,
    riasecCode: profile.riasecCode,
  });
  const careerDataFingerprint = await getCareerDataFingerprint();
  const snapshot = profile.careerRecommendationSnapshot;
  const canReuseSnapshot =
    snapshot?.algorithmVersion === RECOMMENDATION_ALGORITHM_VERSION &&
    snapshot.recommendationLimit === DEFAULT_RECOMMENDATION_LIMIT &&
    snapshot.elementScoresFingerprint === elementScoresFingerprint &&
    snapshot.profileRecommendationFingerprint ===
      profileRecommendationFingerprint &&
    snapshot.careerDataFingerprint === careerDataFingerprint &&
    Array.isArray(snapshot.recommendations);

  if (canReuseSnapshot) {
    const recommendations = await addElementNamesToRecommendations(
      snapshot.recommendations
    );

    return {
      recommendations,
      count: recommendations.length,
      limit: DEFAULT_RECOMMENDATION_LIMIT,
      elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
      generatedAt: snapshot.generatedAt,
      cached: true,
    };
  }

  const careers = await Career.find(RECOMMENDABLE_CAREER_FILTER)
    .select(
      "onetCode title_en title_vi aliases description_vi careerCluster riasecCode vietnam_relevance elements"
    )
    .lean();
  const rankedRecommendations = rankCareerRecommendations({
    elementScores,
    careers,
    limit: DEFAULT_RECOMMENDATION_LIMIT,
    profile: {
      riasecCode: profile.riasecCode,
    },
  });
  const recommendations = await addElementNamesToRecommendations(
    rankedRecommendations
  );
  const generatedAt = new Date();

  await StudentProfile.updateOne(
    { _id: profile._id },
    {
      $set: {
        careerRecommendationSnapshot: {
          algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
          recommendationLimit: DEFAULT_RECOMMENDATION_LIMIT,
          elementScoresFingerprint,
          profileRecommendationFingerprint,
          careerDataFingerprint,
          recommendations,
          generatedAt,
        },
      },
    },
    {
      runValidators: true,
    }
  );

  return {
    recommendations,
    count: recommendations.length,
    limit: DEFAULT_RECOMMENDATION_LIMIT,
    elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
    generatedAt,
    cached: false,
  };
}

module.exports = { getCareerRecommendationsForUser };
