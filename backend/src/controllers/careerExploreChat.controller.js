const Career = require("../models/Career");
const Element = require("../models/Element");
const StudentProfile = require("../models/StudentProfile");
const {
  buildCareerExploreChatMessages,
} = require("../prompts/careerExploreChat");
const {
  normalizeConversation,
  parseCareerExploreChatResponse,
  shouldSearchVietnamJobMarket,
} = require("../services/careerExploreChat.service");
const { callDeepSeek } = require("../services/deepseekClient");
const {
  calculateProfileElementScores,
  ELEMENT_SCORE_ALGORITHM_VERSION,
} = require("../services/profileElementScore.service");
const {
  searchVietnamJobMarket,
} = require("../services/webSearch.service");

const MAX_PROFILE_ELEMENTS = 8;
const JSON_RETRY_MESSAGE = `Phản hồi trước không phải JSON hợp lệ.
Hãy trả lại đúng một JSON object theo schema đã yêu cầu.
Không dùng markdown code fence, không thêm giải thích trước hoặc sau JSON.`;

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

async function getTopProfileElements(profile) {
  const elementScores = await getCurrentElementScores(profile);
  const topElementScores = [...(elementScores || [])]
    .filter((element) => Number(element.finalScore) > 0)
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, MAX_PROFILE_ELEMENTS);
  const elementCodes = topElementScores.map((element) => element.code);
  const elements = await Element.find({ code: { $in: elementCodes } })
    .select("code name_vi name_en")
    .lean();
  const elementNameMap = new Map(
    elements.map((element) => [element.code, element])
  );

  return topElementScores.map((element) => ({
    ...element,
    name_vi: elementNameMap.get(element.code)?.name_vi,
    name_en: elementNameMap.get(element.code)?.name_en,
  }));
}

async function getSearchContext(career, latestUserMessage) {
  const shouldSearch =
    latestUserMessage &&
    shouldSearchVietnamJobMarket(latestUserMessage.content);

  if (!shouldSearch) {
    return {
      searchResults: [],
      webSearchStatus: "not_needed",
    };
  }

  try {
    const searchResponse = await searchVietnamJobMarket({
      careerTitle: career.title_vi || career.title_en,
      question: latestUserMessage.content,
    });

    return {
      searchResults: searchResponse.results,
      webSearchStatus: searchResponse.status,
    };
  } catch (error) {
    console.error("Career explore web search failed", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
    });

    return {
      searchResults: [],
      webSearchStatus: "failed",
    };
  }
}

async function getParsedChatResponse(messages) {
  const rawResponse = await callDeepSeek(messages);

  try {
    return parseCareerExploreChatResponse(rawResponse);
  } catch (error) {
    if (error.code !== "INVALID_AI_JSON") {
      throw error;
    }

    console.warn("Retrying career explore chat because DeepSeek returned invalid JSON", {
      rawResponsePreview: error.rawResponsePreview,
    });
    const retryResponse = await callDeepSeek([
      ...messages,
      {
        role: "user",
        content: JSON_RETRY_MESSAGE,
      },
    ]);

    return parseCareerExploreChatResponse(retryResponse);
  }
}

async function exploreCareerChat(req, res) {
  let stage = "load_context";

  try {
    const [profile, career] = await Promise.all([
      StudentProfile.findOne({ userId: req.user._id })
        .select(
          "grade favoriteSubjects strongSubjects goal riasecCode elementScores elementScoreVersion coreQuizAnswers aiDiscoveries"
        )
        .lean(),
      Career.findById(req.params.id)
        .select("title_en title_vi description_vi careerCluster")
        .lean(),
    ]);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (!career) {
      return res.status(404).json({ message: "Career not found" });
    }

    stage = "normalize_conversation";
    const conversation = normalizeConversation(req.body?.messages);
    const latestUserMessage = [...conversation]
      .reverse()
      .find((message) => message.role === "user");
    stage = "search_web";
    const { searchResults, webSearchStatus } = await getSearchContext(
      career,
      latestUserMessage
    );
    stage = "load_profile_elements";
    const topElements = await getTopProfileElements(profile);
    stage = "call_and_parse_deepseek_response";
    const messages = buildCareerExploreChatMessages({
      career,
      profile,
      topElements,
      conversation,
      searchResults,
    });
    const chatResponse = await getParsedChatResponse(
      messages
    );

    return res.json({
      ...chatResponse,
      usedWebSearch: searchResults.length > 0,
      webSearchStatus,
      sources: searchResults.map(({ title, url }) => ({ title, url })),
    });
  } catch (error) {
    console.error("Career explore chat failed", {
      stage,
      userId: String(req.user?._id || ""),
      careerId: String(req.params?.id || ""),
      name: error.name,
      message: error.message,
      status: error.status,
      statusCode: error.statusCode,
      code: error.code,
      type: error.type,
      rawResponsePreview: error.rawResponsePreview,
    });

    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Không thể trả lời câu hỏi lúc này. Vui lòng thử lại.",
    });
  }
}

module.exports = { exploreCareerChat };
