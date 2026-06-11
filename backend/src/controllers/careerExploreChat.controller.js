const Career = require("../models/Career");
const Element = require("../models/Element");
const StudentProfile = require("../models/StudentProfile");
const {
  buildCareerExploreChatMessages,
} = require("../prompts/careerExploreChat");
const {
  normalizeConversation,
  normalizeFeedback,
  normalizeMessageIndex,
  normalizeSessionTitle,
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
const { formatCareerClusters } = require("../utils/careerCluster");

const MAX_PROFILE_ELEMENTS = 8;
const MAX_STORED_CHAT_MESSAGES = 80;
const MAX_STORED_CHAT_SESSIONS = 20;
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
      searchAttempted: false,
      webSearchStatus: "not_needed",
      webSearchMessage: "Không cần tìm kiếm web cho câu hỏi này.",
    };
  }

  try {
    const searchResponse = await searchVietnamJobMarket({
      careerTitle: career.title_vi || career.title_en,
      question: latestUserMessage.content,
    });

    return {
      searchResults: searchResponse.results,
      searchAttempted: true,
      webSearchStatus: searchResponse.status,
      webSearchMessage:
        searchResponse.status === "completed"
          ? "Đã kiểm tra nguồn web liên quan."
          : "Chưa cấu hình nguồn tìm kiếm web.",
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
      searchAttempted: true,
      webSearchStatus: "failed",
      webSearchMessage: "Không thể kiểm tra nguồn web ở lượt này.",
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

function findCareerExploreChatSession(profile, careerId) {
  return (profile.careerExploreChatSessions || []).find(
    (session) => String(session.careerId) === String(careerId)
  );
}

function toClientMessage(message) {
  return {
    role: message.role,
    content: message.content,
    sources: message.sources || [],
    webSearchStatus: message.webSearchStatus || "",
    feedback: {
      rating: message.feedback?.rating || "",
      reason: message.feedback?.reason || "",
    },
  };
}

function buildStoredMessages({
  conversation,
  chatResponse,
  searchResults,
  webSearchStatus,
}) {
  const sources = searchResults.map(({ title, url }) => ({ title, url }));
  const now = new Date();

  return [
    ...conversation.map((message) => ({
      role: message.role,
      content: message.content,
      sources: message.sources || [],
      webSearchStatus: message.webSearchStatus || "",
      feedback: message.feedback || {},
      createdAt: message.createdAt || now,
    })),
    {
      role: "assistant",
      content: chatResponse.answer,
      sources,
      webSearchStatus,
      createdAt: now,
    },
  ].slice(-MAX_STORED_CHAT_MESSAGES);
}

function hydrateConversationMetadata(conversation, savedSession) {
  const savedMessages = savedSession?.messages || [];

  return conversation.map((message, index) => {
    const savedMessage = savedMessages[index];

    if (
      savedMessage?.role === message.role &&
      savedMessage?.content === message.content
    ) {
      return {
        ...message,
        sources: savedMessage.sources || [],
        webSearchStatus: savedMessage.webSearchStatus || "",
        createdAt: savedMessage.createdAt,
      };
    }

    return message;
  });
}

async function saveCareerExploreChatSession({
  profile,
  careerId,
  messages,
  suggestedQuestions,
  title,
}) {
  const existingSession = findCareerExploreChatSession(profile, careerId);
  const existingSessions = (profile.careerExploreChatSessions || []).filter(
    (session) => String(session.careerId) !== String(careerId)
  );
  const updatedSession = {
    careerId,
    title: title || existingSession?.title || "",
    messages,
    suggestedQuestions,
    updatedAt: new Date(),
  };
  const nextSessions = [...existingSessions, updatedSession].slice(
    -MAX_STORED_CHAT_SESSIONS
  );

  await StudentProfile.updateOne(
    { _id: profile._id },
    {
      $set: {
        careerExploreChatSessions: nextSessions,
      },
    },
    { runValidators: true }
  );

  return updatedSession;
}

async function resetCareerExploreChatSession(profile, careerId) {
  await StudentProfile.updateOne(
    { _id: profile._id },
    {
      $pull: {
        careerExploreChatSessions: { careerId },
      },
    },
    { runValidators: true }
  );
}

function getDefaultChatTitle(careerTitle) {
  return `Tìm hiểu về ngành ${careerTitle}`;
}

function normalizeRegenerateConversation(conversation) {
  if (!conversation.length) {
    return conversation;
  }

  const nextConversation = [...conversation];
  const lastMessage = nextConversation[nextConversation.length - 1];

  if (lastMessage?.role === "assistant") {
    nextConversation.pop();
  }

  if (!nextConversation.some((message) => message.role === "user")) {
    const error = new Error("Cannot regenerate before a user question");
    error.statusCode = 400;
    throw error;
  }

  return nextConversation;
}

async function listCareerExploreChats(req, res) {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user._id })
      .select("careerExploreChatSessions")
      .lean();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const sessions = [...(profile.careerExploreChatSessions || [])].sort(
      (left, right) =>
        new Date(right.updatedAt || 0).getTime() -
        new Date(left.updatedAt || 0).getTime()
    );
    const careerIds = sessions.map((session) => session.careerId).filter(Boolean);
    const careers = await Career.find({ _id: { $in: careerIds } })
      .select("title_en title_vi careerCluster")
      .lean();
    const careerMap = new Map(
      careers.map((career) => [String(career._id), career])
    );

    return res.json({
      chats: sessions.map((session) => {
        const career = careerMap.get(String(session.careerId));
        const careerTitle =
          career?.title_vi || career?.title_en || "nghề đã lưu";
        const lastMessage = [...(session.messages || [])]
          .reverse()
          .find((message) => message.content);

        return {
          careerId: String(session.careerId),
          title: session.title || getDefaultChatTitle(careerTitle),
          careerTitle,
          careerCluster: formatCareerClusters(career?.careerCluster),
          lastMessage: lastMessage?.content || "",
          messageCount: session.messages?.length || 0,
          updatedAt: session.updatedAt,
          suggestedQuestions: session.suggestedQuestions || [],
          careerExists: Boolean(career),
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Không thể tải danh sách hội thoại lúc này. Vui lòng thử lại.",
      error: error.message,
    });
  }
}

async function updateCareerExploreChatTitle(req, res) {
  try {
    const title = normalizeSessionTitle(req.body?.title);
    const profile = await StudentProfile.findOne({ userId: req.user._id })
      .select("careerExploreChatSessions")
      .lean();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const session = findCareerExploreChatSession(profile, req.params.id);

    if (!session) {
      return res.status(404).json({ message: "Career explore chat session not found" });
    }

    await StudentProfile.updateOne(
      {
        _id: profile._id,
        "careerExploreChatSessions.careerId": req.params.id,
      },
      {
        $set: {
          "careerExploreChatSessions.$.title": title,
          "careerExploreChatSessions.$.updatedAt": new Date(),
        },
      },
      { runValidators: true }
    );

    return res.json({ title });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Không thể đổi tên hội thoại lúc này. Vui lòng thử lại.",
    });
  }
}

async function deleteCareerExploreChatSession(req, res) {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user._id })
      .select("careerExploreChatSessions")
      .lean();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    await resetCareerExploreChatSession(profile, req.params.id);

    return res.json({ deleted: true });
  } catch (error) {
    return res.status(500).json({
      message: "Không thể xóa hội thoại lúc này. Vui lòng thử lại.",
    });
  }
}

async function submitCareerExploreChatFeedback(req, res) {
  try {
    const messageIndex = normalizeMessageIndex(req.body?.messageIndex);
    const feedback = normalizeFeedback(req.body);
    const profile = await StudentProfile.findOne({ userId: req.user._id })
      .select("careerExploreChatSessions")
      .lean();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const session = findCareerExploreChatSession(profile, req.params.id);

    if (!session) {
      return res.status(404).json({ message: "Career explore chat session not found" });
    }

    const targetMessage = session.messages?.[messageIndex];

    if (!targetMessage || targetMessage.role !== "assistant") {
      return res.status(400).json({
        message: "Feedback can only be attached to an assistant message",
      });
    }

    await StudentProfile.updateOne(
      {
        _id: profile._id,
        "careerExploreChatSessions.careerId": session.careerId,
      },
      {
        $set: {
          [`careerExploreChatSessions.$.messages.${messageIndex}.feedback`]: {
            ...feedback,
            updatedAt: new Date(),
          },
        },
      },
      {
        runValidators: true,
      }
    );

    return res.json({ feedback });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Không thể lưu đánh giá lúc này. Vui lòng thử lại.",
    });
  }
}

async function exploreCareerChat(req, res) {
  let stage = "load_context";

  try {
    const [profile, career] = await Promise.all([
      StudentProfile.findOne({ userId: req.user._id })
        .select(
          "grade favoriteSubjects strongSubjects goal riasecCode elementScores elementScoreVersion coreQuizAnswers aiDiscoveries careerExploreChatSessions"
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
    const savedSession = findCareerExploreChatSession(profile, career._id);
    const shouldReset = req.body?.reset === true;
    const shouldRegenerate = req.body?.regenerate === true;
    const hydratedConversation = hydrateConversationMetadata(
      normalizeConversation(req.body?.messages),
      savedSession
    );
    const conversation = shouldRegenerate
      ? normalizeRegenerateConversation(hydratedConversation)
      : hydratedConversation;

    if (shouldReset) {
      stage = "reset_saved_session";
      await resetCareerExploreChatSession(profile, career._id);
    } else if (conversation.length === 0 && savedSession) {
      return res.json({
        messages: (savedSession.messages || []).map(toClientMessage),
        suggestedQuestions: savedSession.suggestedQuestions || [],
        title: savedSession.title || "",
        cached: true,
      });
    }

    const latestUserMessage = [...conversation]
      .reverse()
      .find((message) => message.role === "user");
    stage = "search_web";
    const {
      searchResults,
      searchAttempted,
      webSearchStatus,
      webSearchMessage,
    } = await getSearchContext(career, latestUserMessage);
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
    const storedMessages = buildStoredMessages({
      conversation,
      chatResponse,
      searchResults,
      webSearchStatus,
    });
    const savedChatSession = await saveCareerExploreChatSession({
      profile,
      careerId: career._id,
      messages: storedMessages,
      suggestedQuestions: chatResponse.suggestedQuestions,
    });

    return res.json({
      ...chatResponse,
      messages: savedChatSession.messages.map(toClientMessage),
      usedWebSearch: searchResults.length > 0,
      searchAttempted,
      webSearchStatus,
      webSearchMessage,
      sources: searchResults.map(({ title, url }) => ({ title, url })),
      regenerated: shouldRegenerate,
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

module.exports = {
  deleteCareerExploreChatSession,
  exploreCareerChat,
  listCareerExploreChats,
  submitCareerExploreChatFeedback,
  updateCareerExploreChatTitle,
};
