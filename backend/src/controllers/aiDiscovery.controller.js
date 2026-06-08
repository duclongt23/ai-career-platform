const mongoose = require("mongoose");
const AiDiscoverySession = require("../models/AiDiscovery");
const StudentProfile = require("../models/StudentProfile");
const {
  buildAiDiscoveryMoreCandidatesPrompt,
  buildAiDiscoveryPrompt,
} = require("../prompts/aiDiscoveryPrompt");
const {
  buildAiDiscoveryOpeningMessage,
  getAiDiscoveryOpeningOptions,
  getDefaultOpeningQuestion,
  getOpeningQuestionById,
} = require("../services/aiDiscoveryOpeningService");
const { callDeepSeek } = require("../services/deepseekClient");
const {
  getElementsForAiDiscovery,
} = require("../services/elementSelectionService");
const {
  calculateProfileElementScores,
  ELEMENT_SCORE_ALGORITHM_VERSION,
} = require("../services/profileElementScore.service");
const {
  CONFIRM_LEVELS,
  DEFAULT_AI_CONFIDENCE,
  MAX_AI_DISCOVERY_MESSAGE_LENGTH,
  MAX_STORED_MESSAGES,
} = require("../constants/aiDiscovery");

const MAX_MESSAGE_LENGTH = 2000;
// Chỉ gửi phần hội thoại gần nhất để prompt không tăng vô hạn qua mỗi lượt chat.
const MAX_CONTEXT_MESSAGES = 20;
const JSON_RETRY_MESSAGE = `Phản hồi trước không phải JSON hợp lệ.
Hãy trả lại đúng một JSON object theo schema đã yêu cầu.
Không dùng markdown code fence, không thêm giải thích trước hoặc sau JSON.`;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeMessage(message) {
  if (typeof message !== "string" || !message.trim()) {
    throw createHttpError(400, "message is required");
  }

  const normalized = message.trim();

  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw createHttpError(
      400,
      `message must not exceed ${MAX_MESSAGE_LENGTH} characters`
    );
  }

  return normalized;
}

function trimStoredMessages(session) {
  if (session.messages.length <= MAX_STORED_MESSAGES) {
    return false;
  }

  session.messages = session.messages.slice(-MAX_STORED_MESSAGES);
  return true;
}

async function getOrCreateSession(
  userId,
  sessionId,
  { allowConfirmedSession = false, resumeLatestConfirmed = false } = {}
) {
  if (sessionId) {
    if (!mongoose.isValidObjectId(sessionId)) {
      throw createHttpError(400, "Invalid sessionId");
    }

    const session = await AiDiscoverySession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      throw createHttpError(404, "AI discovery session not found");
    }

    if (
      session.status === "cancelled" ||
      (session.status === "confirmed" && !allowConfirmedSession)
    ) {
      throw createHttpError(409, "AI discovery session is already closed");
    }

    return session;
  }

  // Frontend không bắt buộc giữ sessionId: ưu tiên tiếp tục phiên gần nhất còn mở.
  const activeSession = await AiDiscoverySession.findOne({
    userId,
    status: { $in: ["in_progress", "ready_to_confirm"] },
  }).sort({ updatedAt: -1 });

  if (activeSession) {
    return activeSession;
  }

  if (resumeLatestConfirmed) {
    // Reloading the page should show the student's last confirmed result.
    // Starting a new conversation remains an explicit action through reset.
    const confirmedSession = await AiDiscoverySession.findOne({
      userId,
      status: "confirmed",
    }).sort({ updatedAt: -1 });

    if (confirmedSession) {
      return confirmedSession;
    }
  }

  return new AiDiscoverySession({ userId });
}

async function getProfileWithRiasec(userId) {
  const profile = await StudentProfile.findOne({ userId }).lean();

  if (!profile) {
    throw createHttpError(404, "Profile not found");
  }

  if (!profile.riasecCode) {
    throw createHttpError(
      400,
      "Complete the RIASEC test before starting AI discovery"
    );
  }

  return profile;
}

function ensureOpeningMessage(session, profile, openingQuestionId) {
  if (session.messages.length > 0) {
    return false;
  }

  const requestedOpening = openingQuestionId
    ? getOpeningQuestionById(openingQuestionId)
    : null;

  if (openingQuestionId && !requestedOpening) {
    throw createHttpError(400, "Invalid openingQuestionId");
  }

  const openingQuestion = requestedOpening || getDefaultOpeningQuestion(profile);

  // Lưu metadata để biết phiên này bắt đầu từ góc nào; element selection các
  // lượt sau dùng chính topic này để tránh mỗi request suy diễn lại từ message.
  session.openingQuestionId = openingQuestion.id;
  session.openingTopic = openingQuestion.topic;
  session.topic = openingQuestion.topic;
  session.messages.push({
    role: "assistant",
    content: buildAiDiscoveryOpeningMessage(profile, openingQuestion.id),
  });

  return true;
}

function getOpeningResponseFields(profile, session) {
  return {
    openingOptions: getAiDiscoveryOpeningOptions(profile).map((option) => ({
      id: option.id,
      topic: option.topic,
      title: option.title,
      question: option.question,
      isRecommended: option.isRecommended,
    })),
    openingQuestionId: session.openingQuestionId,
    openingTopic: session.openingTopic,
  };
}

function parseJsonObject(rawResponse) {
  const trimmedResponse = String(rawResponse || "").trim();

  try {
    return JSON.parse(trimmedResponse);
  } catch {
    // Một số model vẫn bọc JSON bằng code fence dù đã bật JSON mode.
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
        // Retry phía dưới sẽ yêu cầu model tạo lại JSON thay vì tự đoán nội dung.
      }
    }

    const error = new Error("DeepSeek returned invalid JSON");
    error.code = "INVALID_AI_JSON";
    error.rawResponsePreview = trimmedResponse.slice(0, 500);
    throw error;
  }
}

function parseAiResponse(rawResponse, availableElements) {
  const response = parseJsonObject(rawResponse);

  if (!["ask_followup", "ready_to_confirm"].includes(response.action)) {
    throw new Error("DeepSeek returned an invalid action");
  }

  const assistantMessage =
    typeof response.assistant_message === "string"
      ? response.assistant_message.trim()
      : "";

  if (!assistantMessage) {
    throw new Error("DeepSeek returned an empty assistant message");
  }

  if (assistantMessage.length > MAX_AI_DISCOVERY_MESSAGE_LENGTH) {
    throw new Error("DeepSeek returned an assistant message that is too long");
  }

  if (response.action === "ask_followup") {
    return {
      action: response.action,
      assistantMessage,
      candidates: [],
    };
  }

  // Không tin trực tiếp code/type/name từ AI. DB là nguồn dữ liệu chuẩn cho element.
  const elementMap = new Map(
    availableElements.map((element) => [
      String(element.code).toLowerCase(),
      element,
    ])
  );
  const seenCodes = new Set();
  const candidates = (Array.isArray(response.candidates)
    ? response.candidates
    : []
  ).reduce((normalized, candidate) => {
    const code = String(candidate?.code || "")
      .trim()
      .toLowerCase();
    const element = elementMap.get(code);

    if (!element || seenCodes.has(code)) {
      return normalized;
    }

    const reason =
      typeof candidate.reason === "string" ? candidate.reason.trim() : "";
    const confidence = Number(candidate.confidence);

    if (!reason || !Number.isFinite(confidence)) {
      return normalized;
    }

    seenCodes.add(code);
    normalized.push({
      code: element.code,
      type: element.type,
      name_vi: element.name_vi,
      reason,
      confidence: Math.min(1, Math.max(0.1, confidence)),
    });

    return normalized;
  }, []);

  if (candidates.length < 3 || candidates.length > 6) {
    throw new Error("DeepSeek returned an invalid candidate list");
  }

  return {
    action: response.action,
    assistantMessage,
    candidates,
  };
}

async function getParsedAiResponse(prompt, elements) {
  const rawResponse = await callDeepSeek(prompt);

  try {
    return parseAiResponse(rawResponse, elements);
  } catch (error) {
    if (error.code !== "INVALID_AI_JSON") {
      throw error;
    }

    // JSON mode vẫn có xác suất trả output lỗi; retry một lần với yêu cầu chặt hơn.
    console.warn("Retrying AI discovery because DeepSeek returned invalid JSON", {
      rawResponsePreview: error.rawResponsePreview,
    });
    const retryResponse = await callDeepSeek([
      ...prompt,
      {
        role: "user",
        content: JSON_RETRY_MESSAGE,
      },
    ]);

    return parseAiResponse(retryResponse, elements);
  }
}

function getPromptElements(elements) {
  // Chỉ gửi các field cần cho quyết định của AI để giảm token và tránh lộ metadata DB.
  return elements.map((element) => ({
    code: element.code,
    type: element.type,
    name_vi: element.name_vi,
    description:
      element.description_vi || "",
    riasecScore: element.riasecScore,
  }));
}

function getCandidatePromptSummary(candidates = []) {
  return candidates.map((candidate) => ({
    code: candidate.code,
    type: candidate.type,
    name_vi: candidate.name_vi,
    reason: candidate.reason,
    confidence: candidate.confidence,
  }));
}

function getNormalizedCodeSet(codes = []) {
  return new Set(
    (Array.isArray(codes) ? codes : [])
      .map((code) =>
        String(typeof code === "object" ? code?.code : code || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );
}

function mergeCandidates(existingCandidates = [], newCandidates = []) {
  const seenCodes = new Set();
  const merged = [];

  [...existingCandidates, ...newCandidates].forEach((candidate) => {
    const code = String(candidate?.code || "")
      .trim()
      .toLowerCase();

    if (!code || seenCodes.has(code)) {
      return;
    }

    seenCodes.add(code);
    merged.push(candidate);
  });

  return merged;
}

async function sendMessage(req, res) {
  try {
    const message = normalizeMessage(req.body?.message);
    const profile = await getProfileWithRiasec(req.user._id);
    const session = await getOrCreateSession(req.user._id, req.body?.sessionId);

    // Giữ đúng flow opening -> user reply kể cả khi frontend hoặc client cũ
    // gọi thẳng /message mà chưa chọn câu hỏi mở đầu.
    ensureOpeningMessage(session, profile, req.body?.openingQuestionId);

    const elements = await getElementsForAiDiscovery(profile, {
      openingTopic: session.openingTopic,
      seed: session._id,
    });

    if (elements.length === 0) {
      throw createHttpError(
        422,
        "No suitable elements found for this RIASEC profile"
      );
    }

    // Lưu câu trả lời trước khi gọi upstream để không mất nội dung khi DeepSeek lỗi.
    session.messages.push({
      role: "user",
      content: message,
    });
    trimStoredMessages(session);
    session.status = "in_progress";
    session.extractedCandidates = [];
    await session.save();

    // Tách lỗi upstream khỏi lỗi request: sessionId vẫn được trả về để frontend retry.
    try {
      const prompt = buildAiDiscoveryPrompt({
        profile: {
          grade: profile.grade,
          favoriteSubjects: profile.favoriteSubjects,
          strongSubjects: profile.strongSubjects,
          goal: profile.goal,
          riasecCode: profile.riasecCode,
          riasecScores: profile.riasecScores,
        },
        followUpCount: session.followUpCount,
        messages: session.messages.slice(-MAX_CONTEXT_MESSAGES),
        elements: getPromptElements(elements),
      });
      const aiResponse = await getParsedAiResponse(prompt, elements);

      session.messages.push({
        role: "assistant",
        content: aiResponse.assistantMessage,
      });
      trimStoredMessages(session);
      session.status =
        aiResponse.action === "ready_to_confirm"
          ? "ready_to_confirm"
          : "in_progress";
      session.extractedCandidates = aiResponse.candidates;

      if (aiResponse.action === "ask_followup") {
        session.followUpCount += 1;
      }

      await session.save();

      return res.json({
        message: "AI discovery response generated successfully",
        sessionId: session._id,
        status: session.status,
        action: aiResponse.action,
        assistantMessage: aiResponse.assistantMessage,
        candidates: aiResponse.candidates,
        followUpCount: session.followUpCount,
        ...getOpeningResponseFields(profile, session),
      });
    } catch (error) {
      // Ghi lỗi upstream để phân biệt lỗi API, JSON và validate candidate khi debug.
      console.error("AI discovery response error", {
        sessionId: String(session._id),
        name: error.name,
        status: error.status,
        code: error.code,
        type: error.type,
        message: error.message,
        rawResponsePreview: error.rawResponsePreview,
      });

      return res.status(502).json({
        message: "Failed to get AI discovery response",
        sessionId: session._id,
        error: error.message,
      });
    }
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to process AI discovery message",
      error: error.message,
    });
  }
}

async function startSession(req, res) {
  try {
    const profile = await getProfileWithRiasec(req.user._id);
    const session = await getOrCreateSession(req.user._id, req.body?.sessionId, {
      allowConfirmedSession: true,
      resumeLatestConfirmed: true,
    });
    const openingCreated = req.body?.openingQuestionId
      ? ensureOpeningMessage(session, profile, req.body.openingQuestionId)
      : false;
    const messagesTrimmed = trimStoredMessages(session);
    const shouldPersistBlankSession =
      session.isNew && session.messages.length === 0;

    if (openingCreated || messagesTrimmed || shouldPersistBlankSession) {
      await session.save();
    }

    if (session.status === "confirmed") {
      // Lazily backfill profile scores for confirmations created before the
      // profile-wide scoring algorithm existed. The operation is idempotent.
      await persistProfileAiDiscoverySnapshot(req.user._id, session);
    }

    return res.json({
      message: openingCreated
        ? "AI discovery session started successfully"
        : "AI discovery session loaded successfully",
      sessionId: session._id,
      status: session.status,
      action:
        session.status === "confirmed"
          ? "confirmed"
          : session.status === "ready_to_confirm"
            ? "ready_to_confirm"
            : session.messages.length === 0
              ? "select_opening"
              : "awaiting_user_message",
      messages: session.messages,
      assistantMessage:
        session.messages[session.messages.length - 1]?.role === "assistant"
          ? session.messages[session.messages.length - 1].content
          : null,
      candidates: session.extractedCandidates,
      confirmedElements: session.confirmedElements,
      followUpCount: session.followUpCount,
      openingCreated,
      ...getOpeningResponseFields(profile, session),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to start AI discovery session",
      error: error.message,
    });
  }
}

async function resetSession(req, res) {
  try {
    const profile = await getProfileWithRiasec(req.user._id);

    // Giữ lịch sử để audit nhưng đóng toàn bộ phiên cũ, tránh resume nhầm sau reset.
    await AiDiscoverySession.updateMany(
      {
        userId: req.user._id,
        status: { $in: ["in_progress", "ready_to_confirm"] },
      },
      {
        $set: {
          status: "cancelled",
        },
      }
    );

    const session = new AiDiscoverySession({ userId: req.user._id });
    await session.save();

    return res.json({
      message: "AI discovery session reset successfully",
      sessionId: session._id,
      status: session.status,
      action: "select_opening",
      messages: session.messages,
      assistantMessage: null,
      candidates: [],
      followUpCount: 0,
      openingCreated: false,
      ...getOpeningResponseFields(profile, session),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to reset AI discovery session",
      error: error.message,
    });
  }
}

async function findMoreCandidates(req, res) {
  try {
    const { sessionId } = req.body || {};

    if (!mongoose.isValidObjectId(sessionId)) {
      throw createHttpError(400, "Invalid sessionId");
    }

    const profile = await getProfileWithRiasec(req.user._id);
    const session = await AiDiscoverySession.findOne({
      _id: sessionId,
      userId: req.user._id,
    });

    if (!session) {
      throw createHttpError(404, "AI discovery session not found");
    }

    if (session.status !== "ready_to_confirm") {
      throw createHttpError(409, "AI discovery session is not ready to expand");
    }

    const existingCodes = getNormalizedCodeSet(session.extractedCandidates);
    const selectedCodes = getNormalizedCodeSet(req.body?.selectedCodes);
    const elements = await getElementsForAiDiscovery(profile, {
      openingTopic: session.openingTopic,
      seed: `${session._id}:more:${session.extractedCandidates.length}`,
      excludedCodes: existingCodes,
    });

    if (elements.length < 3) {
      throw createHttpError(422, "Not enough new elements to suggest");
    }

    const prompt = buildAiDiscoveryMoreCandidatesPrompt({
      profile: {
        grade: profile.grade,
        favoriteSubjects: profile.favoriteSubjects,
        strongSubjects: profile.strongSubjects,
        goal: profile.goal,
        riasecCode: profile.riasecCode,
        riasecScores: profile.riasecScores,
      },
      messages: session.messages.slice(-MAX_CONTEXT_MESSAGES),
      existingCandidates: getCandidatePromptSummary(session.extractedCandidates),
      selectedCodes: [...selectedCodes],
      elements: getPromptElements(elements),
    });
    const aiResponse = await getParsedAiResponse(prompt, elements);

    if (aiResponse.action !== "ready_to_confirm") {
      throw new Error("DeepSeek did not return additional candidates");
    }

    const mergedCandidates = mergeCandidates(
      session.extractedCandidates,
      aiResponse.candidates
    );

    session.messages.push({
      role: "assistant",
      content: aiResponse.assistantMessage,
    });
    trimStoredMessages(session);
    session.status = "ready_to_confirm";
    session.extractedCandidates = mergedCandidates;
    await session.save();

    return res.json({
      message: "Additional AI discovery candidates generated successfully",
      sessionId: session._id,
      status: session.status,
      action: "ready_to_confirm",
      assistantMessage: aiResponse.assistantMessage,
      candidates: session.extractedCandidates,
      addedCandidates: aiResponse.candidates,
      followUpCount: session.followUpCount,
      ...getOpeningResponseFields(profile, session),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to find more AI discovery candidates",
      error: error.message,
    });
  }
}

function buildProfileAiDiscoverySnapshot(session) {
  return {
    sessionId: session._id,
    confirmedElements: session.confirmedElements.map((element) => ({
      code: element.code,
      type: element.type,
      level: element.level,
      contribution: Number.isFinite(Number(element.contribution))
        ? Number(element.contribution)
        : DEFAULT_AI_CONFIDENCE,
    })),
  };
}

async function persistProfileAiDiscoverySnapshot(userId, session) {
  const snapshot = buildProfileAiDiscoverySnapshot(session);

  const insertedSnapshot = await StudentProfile.findOneAndUpdate(
    {
      userId,
      "aiDiscoveries.sessionId": { $ne: session._id },
    },
    {
      $push: {
        aiDiscoveries: snapshot,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  // Older profile snapshots did not retain the AI confidence contribution.
  // Refresh only the confirmed elements in-place so historical answers and
  // creation timestamps remain unchanged while scoring can use current data.
  const profile = await StudentProfile.findOne({ userId })
    .select("coreQuizAnswers aiDiscoveries elementScoreVersion")
    .lean();

  if (!profile) {
    throw createHttpError(404, "Profile not found");
  }

  const storedSnapshot = profile.aiDiscoveries.find(
    (discovery) => String(discovery.sessionId) === String(session._id)
  );
  const needsSnapshotRefresh =
    JSON.stringify(storedSnapshot?.confirmedElements || []) !==
    JSON.stringify(snapshot.confirmedElements);

  if (needsSnapshotRefresh) {
    await StudentProfile.updateOne(
      {
        userId,
        "aiDiscoveries.sessionId": session._id,
      },
      {
        $set: {
          "aiDiscoveries.$[discovery].confirmedElements":
            snapshot.confirmedElements,
        },
      },
      {
        arrayFilters: [{ "discovery.sessionId": session._id }],
        runValidators: true,
      }
    );

    if (storedSnapshot) {
      // Keep the in-memory source synchronized for the recalculation below.
      storedSnapshot.confirmedElements = snapshot.confirmedElements;
    }
  }

  const needsScoreRefresh =
    insertedSnapshot ||
    needsSnapshotRefresh ||
    profile.elementScoreVersion !== ELEMENT_SCORE_ALGORITHM_VERSION;

  if (!needsScoreRefresh) {
    return;
  }

  // Rebuild after source changes and on idempotent retries with a stale cache
  // version. Source snapshots stay deduplicated by sessionId while derived
  // scores remain recoverable if a previous request stopped midway.
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
    {
      runValidators: true,
    }
  );
}

async function confirmCandidates(req, res) {
  try {
    const { sessionId, elements } = req.body || {};

    if (!mongoose.isValidObjectId(sessionId)) {
      throw createHttpError(400, "Invalid sessionId");
    }

    if (!Array.isArray(elements) || elements.length === 0) {
      throw createHttpError(400, "Select at least one candidate element");
    }

    const session = await AiDiscoverySession.findOne({
      _id: sessionId,
      userId: req.user._id,
    });

    if (!session) {
      throw createHttpError(404, "AI discovery session not found");
    }

    // Confirm là idempotent: request lặp lại sau khi lưu vẫn nhận kết quả thành công.
    if (session.status === "confirmed") {
      await persistProfileAiDiscoverySnapshot(req.user._id, session);

      return res.json({
        message: "AI discovery candidates already confirmed",
        sessionId: session._id,
        status: session.status,
        confirmedElements: session.confirmedElements,
      });
    }

    if (session.status !== "ready_to_confirm") {
      throw createHttpError(409, "AI discovery session is not ready to confirm");
    }

    const candidateMap = new Map(
      session.extractedCandidates.map((candidate) => [
        String(candidate.code).toLowerCase(),
        candidate,
      ])
    );
    const seenCodes = new Set();
    const confirmedElements = elements.map((element) => {
      const code = String(element?.code || "")
        .trim()
        .toLowerCase();
      const level = Number(element?.level);
      const candidate = candidateMap.get(code);

      // Chỉ lưu element đã được AI đề xuất trong chính session hiện tại.
      if (!candidate || seenCodes.has(code)) {
        throw createHttpError(400, `Invalid candidate element: ${code}`);
      }

      if (!CONFIRM_LEVELS.includes(level)) {
        throw createHttpError(400, `Invalid level for candidate element: ${code}`);
      }

      seenCodes.add(code);

      return {
        code: candidate.code,
        type: candidate.type,
        level,
        contribution: candidate.confidence,
      };
    });

    // Chỉ một request được quyền chuyển trạng thái để tránh push profile hai lần.
    const confirmedSession = await AiDiscoverySession.findOneAndUpdate(
      {
        _id: session._id,
        userId: req.user._id,
        status: "ready_to_confirm",
      },
      {
        $set: {
          confirmedElements,
          status: "confirmed",
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!confirmedSession) {
      const latestSession = await AiDiscoverySession.findOne({
        _id: session._id,
        userId: req.user._id,
      });

      if (latestSession?.status === "confirmed") {
        await persistProfileAiDiscoverySnapshot(req.user._id, latestSession);

        return res.json({
          message: "AI discovery candidates already confirmed",
          sessionId: latestSession._id,
          status: latestSession.status,
          confirmedElements: latestSession.confirmedElements,
        });
      }

      throw createHttpError(409, "AI discovery session is not ready to confirm");
    }

    // Lưu snapshot vào profile để bước tổng hợp hồ sơ không phụ thuộc session chat.
    await persistProfileAiDiscoverySnapshot(req.user._id, confirmedSession);

    return res.json({
      message: "AI discovery candidates confirmed successfully",
      sessionId: confirmedSession._id,
      status: confirmedSession.status,
      confirmedElements: confirmedSession.confirmedElements,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to confirm AI discovery candidates",
      error: error.message,
    });
  }
}

module.exports = {
  confirmCandidates,
  findMoreCandidates,
  parseAiResponse,
  resetSession,
  sendMessage,
  startSession,
};
