const crypto = require("node:crypto");
const Element = require("../models/Element");
const StudentProfile = require("../models/StudentProfile");
const {
  buildProfileSummaryInsightMessages,
} = require("../prompts/profileSummaryInsightPrompt");
const { createElementScoresFingerprint } = require("./careerRecommendation.service");
const {
  getCareerRecommendationsForUser,
} = require("./careerRecommendationWorkflow.service");
const { callDeepSeek } = require("./deepseekClient");
const { getCurrentElementScores } = require("./profileElementSnapshot.service");
const { createHttpError } = require("../utils/httpError");
const { normalizeCareerClusters } = require("../utils/careerCluster");

const PROFILE_SUMMARY_INSIGHT_VERSION = 1;
const MIN_INSIGHT_COUNT = 3;
const MAX_INSIGHT_COUNT = 5;
const MAX_INSIGHT_TITLE_LENGTH = 120;
const MAX_INSIGHT_DESCRIPTION_LENGTH = 420;

const RIASEC_INFO_BY_TYPE = {
  REALISTIC: { code: "R", label: "thực tế và kỹ thuật" },
  INVESTIGATIVE: { code: "I", label: "phân tích và tìm hiểu vấn đề" },
  ARTISTIC: { code: "A", label: "sáng tạo và biểu đạt ý tưởng" },
  SOCIAL: { code: "S", label: "hỗ trợ và làm việc với con người" },
  ENTERPRISING: { code: "E", label: "dẫn dắt, thuyết phục và tạo ảnh hưởng" },
  CONVENTIONAL: { code: "C", label: "tổ chức, dữ liệu và quy trình" },
};

const RIASEC_TYPE_BY_CODE = Object.fromEntries(
  Object.entries(RIASEC_INFO_BY_TYPE).map(([type, info]) => [info.code, type])
);

function parseJsonObject(rawResponse) {
  const trimmedResponse = String(rawResponse || "").trim();

  try {
    return JSON.parse(trimmedResponse);
  } catch {
    const withoutCodeFence = trimmedResponse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const firstBraceIndex = withoutCodeFence.indexOf("{");
    const lastBraceIndex = withoutCodeFence.lastIndexOf("}");

    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      try {
        return JSON.parse(
          withoutCodeFence.slice(firstBraceIndex, lastBraceIndex + 1)
        );
      } catch {
        // Let the explicit validation error below explain the bad model output.
      }
    }

    throw new Error("DeepSeek returned invalid profile summary insight JSON");
  }
}

function parseProfileSummaryInsights(rawResponse) {
  const response = parseJsonObject(rawResponse);
  const insights = Array.isArray(response.insights) ? response.insights : [];
  const parsedInsights = insights
    .map((item) => ({
      title: typeof item.title === "string" ? item.title.trim() : "",
      description:
        typeof item.description === "string" ? item.description.trim() : "",
    }))
    .filter((item) => item.title && item.description)
    .slice(0, MAX_INSIGHT_COUNT);

  if (
    parsedInsights.length < MIN_INSIGHT_COUNT ||
    parsedInsights.some(
      (item) =>
        item.title.length > MAX_INSIGHT_TITLE_LENGTH ||
        item.description.length > MAX_INSIGHT_DESCRIPTION_LENGTH
    )
  ) {
    throw new Error("DeepSeek returned invalid profile summary insights");
  }

  return parsedInsights;
}

function formatElementCode(code) {
  return String(code || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getElementDisplayName(element) {
  return (
    element?.name_vi ||
    element?.name_en ||
    element?.name ||
    formatElementCode(element?.code)
  );
}

function buildTopRiasec(profile) {
  const codeOrder = String(profile.riasecCode || "")
    .toUpperCase()
    .split("")
    .reduce((order, code, index) => ({ ...order, [code]: index }), {});

  const byScore = Object.entries(RIASEC_INFO_BY_TYPE)
    .map(([type, info]) => ({
      type,
      code: info.code,
      label: info.label,
      score: Number(profile.riasecScores?.[type] || 0),
      rankFromCode: codeOrder[info.code] ?? Number.POSITIVE_INFINITY,
    }))
    .filter((item) => item.score > 0 || Number.isFinite(item.rankFromCode))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.rankFromCode - b.rankFromCode;
    })
    .slice(0, 3);

  if (byScore.length) {
    return byScore;
  }

  return String(profile.riasecCode || "")
    .toUpperCase()
    .split("")
    .map((code) => {
      const type = RIASEC_TYPE_BY_CODE[code];
      const info = RIASEC_INFO_BY_TYPE[type];

      return info ? { type, code, label: info.label, score: 0 } : null;
    })
    .filter(Boolean)
    .slice(0, 3);
}

function buildCareerClusterSummary(recommendations) {
  const counts = new Map();

  recommendations.forEach((career) => {
    const clusters = normalizeCareerClusters(career.careerCluster);

    clusters.forEach((cluster) => {
      counts.set(cluster, (counts.get(cluster) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([cluster, count]) => ({ cluster, count }))
    .sort((a, b) => b.count - a.count || a.cluster.localeCompare(b.cluster))
    .slice(0, 5);
}

function createProfileSummaryFingerprint(context) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(context))
    .digest("hex");
}

async function getElementNameMap(elementScores) {
  const elementCodes = [
    ...new Set((elementScores || []).map((element) => element.code).filter(Boolean)),
  ];

  if (!elementCodes.length) {
    return new Map();
  }

  const elements = await Element.find({ code: { $in: elementCodes } })
    .select("code name_vi name_en")
    .lean();

  return new Map(elements.map((element) => [element.code, element]));
}

function enrichTopElements(elementScores, elementNameMap) {
  return [...(elementScores || [])]
    .filter((element) => Number(element.finalScore || 0) > 0)
    .sort((a, b) => Number(b.finalScore || 0) - Number(a.finalScore || 0))
    .slice(0, 10)
    .map((element) => {
      const namedElement = elementNameMap.get(element.code);

      return {
        code: element.code,
        type: element.type,
        name_vi: namedElement?.name_vi || "",
        name_en: namedElement?.name_en || "",
        finalScore: Number(element.finalScore || 0),
      };
    });
}

function buildProfileSummaryContext({
  profile,
  elementScores,
  topElements,
  topRiasec,
  recommendations,
}) {
  const topCareerClusters = buildCareerClusterSummary(recommendations);
  const topRecommendedCareers = recommendations.slice(0, 5).map((career) => ({
    title: career.title_vi || career.title_en,
    careerCluster: normalizeCareerClusters(career.careerCluster).slice(0, 3),
    matchScore: career.displayMatchScore || career.matchPercentage || null,
  }));

  return {
    version: PROFILE_SUMMARY_INSIGHT_VERSION,
    profile: {
      grade: profile.grade,
      favoriteSubjects: profile.favoriteSubjects || [],
      strongSubjects: profile.strongSubjects || [],
      goal: profile.goal || "",
      riasecCode: profile.riasecCode || "",
      elementScoresFingerprint: createElementScoresFingerprint(elementScores),
    },
    topRiasec,
    topElements: topElements.map((element) => ({
      code: element.code,
      type: element.type,
      name: getElementDisplayName(element),
      score: Math.round(Number(element.finalScore || 0) * 100),
    })),
    topCareerClusters,
    topRecommendedCareers,
  };
}

function buildFallbackProfileInsights(context) {
  const insights = [];
  const [firstRiasec, secondRiasec] = context.topRiasec || [];
  const topElements = context.topElements || [];
  const topClusters = context.topCareerClusters || [];
  const topCareers = context.topRecommendedCareers || [];

  if (firstRiasec) {
    const secondLabel = secondRiasec ? `, kết hợp với ${secondRiasec.label}` : "";

    insights.push({
      title: `Xu hướng ${firstRiasec.label}`,
      description: `Kết quả RIASEC cho thấy hồ sơ đang nghiêng về ${firstRiasec.label}${secondLabel}. Đây là tín hiệu quan trọng khi so sánh với các nhóm nghề được gợi ý.`,
    });
  }

  if (topElements.length >= 2) {
    insights.push({
      title: "Năng lực nổi bật đã có bằng chứng",
      description: `Các yếu tố nổi bật hiện tại gồm ${topElements
        .slice(0, 3)
        .map((element) => element.name)
        .join(", ")}. Nhóm này nên được dùng làm điểm tựa khi đọc danh sách nghề phù hợp.`,
    });
  }

  if (topClusters.length) {
    insights.push({
      title: "Nhóm ngành có độ lặp lại cao",
      description: `${topClusters[0].cluster} xuất hiện nhiều trong danh sách nghề gợi ý. Điều này cho thấy dữ liệu hồ sơ đang tạo một hướng khám phá tương đối rõ ở nhóm ngành này.`,
    });
  }

  if (topCareers.length) {
    insights.push({
      title: "Có thể bắt đầu từ vài nghề đại diện",
      description: `Bạn có thể ưu tiên đọc sâu các nghề như ${topCareers
        .slice(0, 2)
        .map((career) => career.title)
        .join(" và ")} để kiểm tra mức độ hứng thú thực tế trước khi mở rộng sang các nghề khác.`,
    });
  }

  const minimumFallbackInsights = [
    {
      title: "Hồ sơ vẫn có thể được làm rõ thêm",
      description:
        "Một số phần dữ liệu còn mỏng, vì vậy kết luận nên được xem như gợi ý ban đầu. Hoàn thành thêm các bước khám phá sẽ giúp insight ổn định hơn.",
    },
    {
      title: "Nên đối chiếu bằng trải nghiệm thực tế",
      description:
        "Các gợi ý hiện tại nên được kiểm tra thêm qua việc đọc mô tả nghề, hỏi AI về công việc hằng ngày và so sánh với môn học hoặc hoạt động bạn thấy hứng thú.",
    },
    {
      title: "Ưu tiên hướng có cả hứng thú và năng lực",
      description:
        "Khi một nhóm nghề vừa khớp RIASEC vừa dùng các yếu tố năng lực nổi bật, đó là hướng nên được xem trước trong danh sách gợi ý.",
    },
  ];

  minimumFallbackInsights.forEach((insight) => {
    if (insights.length < MIN_INSIGHT_COUNT) {
      insights.push(insight);
    }
  });

  return insights.slice(0, MAX_INSIGHT_COUNT);
}

async function getSafeRecommendations(userId) {
  try {
    const result = await getCareerRecommendationsForUser(userId);
    return result.recommendations || [];
  } catch (error) {
    if (error.statusCode === 409) {
      return [];
    }

    throw error;
  }
}

async function getProfileSummaryInsights({ userId, regenerate = false }) {
  const profile = await StudentProfile.findOne({ userId })
    .select(
      "grade favoriteSubjects strongSubjects goal riasecCode riasecScores elementScores elementScoreVersion coreQuizAnswers aiDiscoveries profileSummaryInsight"
    )
    .lean();

  if (!profile) {
    throw createHttpError(404, "Profile not found");
  }

  const elementScores = await getCurrentElementScores(profile);
  const [elementNameMap, recommendations] = await Promise.all([
    getElementNameMap(elementScores),
    getSafeRecommendations(userId),
  ]);
  const topElements = enrichTopElements(elementScores, elementNameMap);
  const topRiasec = buildTopRiasec(profile);
  const context = buildProfileSummaryContext({
    profile,
    elementScores,
    topElements,
    topRiasec,
    recommendations,
  });
  // The fingerprint is built from the compact context sent to AI, so cache reuse
  // follows the same inputs the student actually sees summarized.
  const fingerprint = createProfileSummaryFingerprint(context);
  const cachedInsight = profile.profileSummaryInsight;

  if (
    !regenerate &&
    cachedInsight?.version === PROFILE_SUMMARY_INSIGHT_VERSION &&
    cachedInsight.fingerprint === fingerprint &&
    Array.isArray(cachedInsight.insights) &&
    cachedInsight.insights.length >= MIN_INSIGHT_COUNT
  ) {
    return {
      insights: cachedInsight.insights,
      source: cachedInsight.source,
      generatedAt: cachedInsight.generatedAt,
      cached: true,
    };
  }

  let source = "ai";
  let insights;

  try {
    const rawInsight = await callDeepSeek(
      buildProfileSummaryInsightMessages({ context })
    );
    insights = parseProfileSummaryInsights(rawInsight);
  } catch {
    source = "fallback";
    // AI insight is a presentation layer. When the model/API is unavailable,
    // the dashboard should still show deterministic guidance from profile data.
    insights = buildFallbackProfileInsights(context);
  }

  const generatedAt = new Date();

  await StudentProfile.updateOne(
    { _id: profile._id },
    {
      $set: {
        profileSummaryInsight: {
          version: PROFILE_SUMMARY_INSIGHT_VERSION,
          fingerprint,
          insights,
          source,
          generatedAt,
        },
      },
    },
    { runValidators: true }
  );

  return {
    insights,
    source,
    generatedAt,
    cached: false,
  };
}

module.exports = {
  PROFILE_SUMMARY_INSIGHT_VERSION,
  buildFallbackProfileInsights,
  getProfileSummaryInsights,
  parseProfileSummaryInsights,
};
