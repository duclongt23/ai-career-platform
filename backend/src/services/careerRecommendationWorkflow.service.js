const Career = require("../models/Career");
const StudentProfile = require("../models/StudentProfile");
const {
  DEFAULT_RECOMMENDATION_LIMIT,
  RECOMMENDATION_ALGORITHM_VERSION,
  createElementScoresFingerprint,
  rankCareerRecommendations,
} = require("./careerRecommendation.service");
const {
  ELEMENT_SCORE_ALGORITHM_VERSION,
} = require("./profileElementScore.service");
const { getCurrentElementScores } = require("./profileElementSnapshot.service");
const { RECOMMENDABLE_CAREER_FILTER } = require("./career.service");
const { createHttpError } = require("../utils/httpError");

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
      "elementScores elementScoreVersion coreQuizAnswers aiDiscoveries careerRecommendationSnapshot"
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
  const careerDataFingerprint = await getCareerDataFingerprint();
  const snapshot = profile.careerRecommendationSnapshot;
  const canReuseSnapshot =
    snapshot?.algorithmVersion === RECOMMENDATION_ALGORITHM_VERSION &&
    snapshot.recommendationLimit === DEFAULT_RECOMMENDATION_LIMIT &&
    snapshot.elementScoresFingerprint === elementScoresFingerprint &&
    snapshot.careerDataFingerprint === careerDataFingerprint &&
    Array.isArray(snapshot.recommendations);

  if (canReuseSnapshot) {
    return {
      recommendations: snapshot.recommendations,
      count: snapshot.recommendations.length,
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
  const recommendations = rankCareerRecommendations({
    elementScores,
    careers,
    limit: DEFAULT_RECOMMENDATION_LIMIT,
  });
  const generatedAt = new Date();

  await StudentProfile.updateOne(
    { _id: profile._id },
    {
      $set: {
        careerRecommendationSnapshot: {
          algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
          recommendationLimit: DEFAULT_RECOMMENDATION_LIMIT,
          elementScoresFingerprint,
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
