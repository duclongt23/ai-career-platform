const StudentProfile = require("../models/StudentProfile");
const {
  calculateProfileElementScores,
  ELEMENT_SCORE_ALGORITHM_VERSION,
} = require("./profileElementScore.service");

async function getCurrentElementScores(profile) {
  if (profile.elementScoreVersion === ELEMENT_SCORE_ALGORITHM_VERSION) {
    return profile.elementScores;
  }

  const elementScores = await calculateProfileElementScores({
    coreQuizAnswers: profile.coreQuizAnswers,
    aiDiscoveries: profile.aiDiscoveries,
  });

  await StudentProfile.updateOne(
    { _id: profile._id },
    {
      $set: {
        elementScores,
        elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
      },
    },
    { runValidators: true }
  );

  return elementScores;
}

module.exports = { getCurrentElementScores };
