const express = require("express");
const Career = require("../models/Career");
const Element = require("../models/Element");
const StudentProfile = require("../models/StudentProfile");
const {
  calculateSimilarity,
  DEFAULT_RECOMMENDATION_LIMIT,
  RECOMMENDATION_ALGORITHM_VERSION,
  createElementScoresFingerprint,
  rankCareerRecommendations,
} = require("../services/careerRecommendation.service");
const {
  findCachedCareerFitExplanation,
  MAX_CACHED_EXPLANATIONS,
  parseCareerFitExplanations,
  selectCareerStrength,
} = require("../services/careerFitExplanation.service");
const {
  buildCareerFitExplanationMessages,
} = require("../prompts/careerFitExplanationPrompt");
const {
  buildCareerDayInLifeMessages,
} = require("../prompts/careerDayInLifePrompt");
const {
  findCachedCareerDayInLife,
  MAX_CACHED_DAY_IN_LIFE_ENTRIES,
  parseCareerDayInLife,
} = require("../services/careerDayInLife.service");
const { callDeepSeek } = require("../services/deepseekClient");
const {
  calculateProfileElementScores,
  ELEMENT_SCORE_ALGORITHM_VERSION,
} = require("../services/profileElementScore.service");
const {
  exploreCareerChat,
  listCareerExploreChats,
} = require("../controllers/careerExploreChat.controller");
const { protect, adminOnly } = require("../middleware/auth.middleware");
const {
  careerExploreChatRateLimit,
} = require("../middleware/rateLimit.middleware");

const router = express.Router();
const RECOMMENDABLE_CAREER_FILTER = {
  is_active: true,
  student_suitable: true,
  "elements.0": { $exists: true },
};

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

router.get("/recommendations/me", protect, async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({
      userId: req.user._id,
    })
      .select(
        "elementScores elementScoreVersion coreQuizAnswers aiDiscoveries careerRecommendationSnapshot"
      )
      .lean();

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    let elementScores = profile.elementScores;

    if (profile.elementScoreVersion !== ELEMENT_SCORE_ALGORITHM_VERSION) {
      elementScores = await calculateProfileElementScores({
        coreQuizAnswers: profile.coreQuizAnswers,
        aiDiscoveries: profile.aiDiscoveries,
      });
      await StudentProfile.updateOne(
        { userId: req.user._id },
        {
          $set: {
            elementScores,
            elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
          },
        },
        {
          runValidators: true,
        }
      );
    }

    if (!elementScores?.some((element) => element.finalScore > 0)) {
      return res.status(409).json({
        message: "Complete the profiling steps before requesting recommendations",
      });
    }

    const elementScoresFingerprint = createElementScoresFingerprint(elementScores);
    const careerDataFingerprint = await getCareerDataFingerprint();
    const snapshot = profile.careerRecommendationSnapshot;
    const canReuseSnapshot =
      snapshot?.algorithmVersion === RECOMMENDATION_ALGORITHM_VERSION &&
      snapshot.elementScoresFingerprint === elementScoresFingerprint &&
      snapshot.careerDataFingerprint === careerDataFingerprint &&
      Array.isArray(snapshot.recommendations);

    if (canReuseSnapshot) {
      return res.json({
        recommendations: snapshot.recommendations,
        count: snapshot.recommendations.length,
        limit: DEFAULT_RECOMMENDATION_LIMIT,
        elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
        generatedAt: snapshot.generatedAt,
        cached: true,
      });
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
      { userId: req.user._id },
      {
        $set: {
          careerRecommendationSnapshot: {
            algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
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

    res.json({
      recommendations,
      count: recommendations.length,
      limit: DEFAULT_RECOMMENDATION_LIMIT,
      elementScoreVersion: ELEMENT_SCORE_ALGORITHM_VERSION,
      generatedAt,
      cached: false,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/:id/fit-explanation", protect, async (req, res) => {
  try {
    const [profile, career] = await Promise.all([
      StudentProfile.findOne({ userId: req.user._id })
        .select(
          "elementScores elementScoreVersion coreQuizAnswers aiDiscoveries careerFitExplanations"
        )
        .lean(),
      Career.findById(req.params.id)
        .select("title_en title_vi description_vi elements updatedAt")
        .lean(),
    ]);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (!career) {
      return res.status(404).json({ message: "Career not found" });
    }

    const elementScores = await getCurrentElementScores(profile);
    const similarity = calculateSimilarity(
      toWeightMap(elementScores, "finalScore"),
      toWeightMap(career.elements, "importance")
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
    const selectedStrength = selectCareerStrength(
      strengths,
      req.body?.selectedStrengthCode
    );
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
      req.body?.regenerate === true
        ? strengths
        : strengths.filter((strength) => !cachedExplanations[strength.code]);

    if (!strengthsToExplain.length) {
      return res.json({
        strengths,
        selectedStrengthCode: selectedStrength.code,
        explanations: cachedExplanations,
        cached: true,
      });
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

    res.json({
      strengths,
      selectedStrengthCode: selectedStrength.code,
      explanations: {
        ...cachedExplanations,
        ...generatedExplanations,
      },
      cached: false,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Không thể tạo lý do phù hợp lúc này. Vui lòng thử lại.",
    });
  }
});

router.post("/:id/day-in-life", protect, async (req, res) => {
  try {
    const [profile, career] = await Promise.all([
      StudentProfile.findOne({ userId: req.user._id })
        .select("careerDayInLifeEntries")
        .lean(),
      Career.findById(req.params.id)
        .select("title_en title_vi description_vi updatedAt")
        .lean(),
    ]);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (!career) {
      return res.status(404).json({ message: "Career not found" });
    }

    const cachedEntry = findCachedCareerDayInLife(
      profile.careerDayInLifeEntries,
      {
        careerId: career._id,
        careerUpdatedAt: career.updatedAt,
      }
    );

    if (cachedEntry && req.body?.regenerate !== true) {
      return res.json({
        activities: cachedEntry.activities,
        cached: true,
      });
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

    res.json({
      activities,
      cached: false,
    });
  } catch (error) {
    res.status(500).json({
      message: "Không thể tạo lịch làm việc lúc này. Vui lòng thử lại.",
    });
  }
});

router.post(
  "/:id/explore-chat",
  protect,
  careerExploreChatRateLimit,
  exploreCareerChat
);

router.get("/explore-chats/me", protect, listCareerExploreChats);

router.get("/", async (req, res) => {
  try {
    const { search, field } = req.query;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 12, 1),
      24
    );
    const filter = {
      is_active: true,
      student_suitable: true,
    };

    if (search) {
      const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchPattern = { $regex: escapedSearch, $options: "i" };

      filter.$or = [
        { title_vi: searchPattern },
        { title_en: searchPattern },
        { aliases: searchPattern },
        { description_vi: searchPattern },
      ];
    }

    if (field) {
      const escapedField = String(field).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.careerCluster = { $regex: escapedField, $options: "i" };
    }

    const [careers, total] = await Promise.all([
      Career.find(filter)
        .select("onetCode title_en title_vi description_vi careerCluster")
        .sort({ vietnam_relevance: -1, title_vi: 1, title_en: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Career.countDocuments(filter),
    ]);

    res.json({
      careers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const career = await Career.findById(req.params.id).lean();

    if (!career) {
      return res.status(404).json({
        message: "Career not found",
      });
    }

    const elementCodes = career.elements.map((element) => element.code);
    const elements = await Element.find({ code: { $in: elementCodes } })
      .select("code name_vi name_en")
      .lean();
    const elementNameMap = new Map(
      elements.map((element) => [element.code, element])
    );

    res.json({
      ...career,
      elements: career.elements.map((element) => ({
        ...element,
        name_vi: elementNameMap.get(element.code)?.name_vi || element.code,
        name_en: elementNameMap.get(element.code)?.name_en || element.code,
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const career = await Career.create(req.body);

    res.status(201).json({
      message: "Career created successfully",
      career,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const career = await Career.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!career) {
      return res.status(404).json({
        message: "Career not found",
      });
    }

    res.json({
      message: "Career updated successfully",
      career,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const career = await Career.findByIdAndDelete(req.params.id);

    if (!career) {
      return res.status(404).json({
        message: "Career not found",
      });
    }

    res.json({
      message: "Career deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
