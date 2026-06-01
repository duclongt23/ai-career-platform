const MAX_CHAT_HISTORY_MESSAGES = 10;
const MAX_CHAT_MESSAGE_LENGTH = 1200;
const MAX_SUGGESTED_QUESTIONS = 4;

function stripMarkdownFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

function parseJsonObject(rawResponse) {
  const normalizedResponse = stripMarkdownFence(rawResponse);

  try {
    return JSON.parse(normalizedResponse);
  } catch {
    const firstBraceIndex = normalizedResponse.indexOf("{");
    const lastBraceIndex = normalizedResponse.lastIndexOf("}");

    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      try {
        return JSON.parse(
          normalizedResponse.slice(firstBraceIndex, lastBraceIndex + 1)
        );
      } catch {
        // Retry is handled by the controller after this parser reports invalid JSON.
      }
    }

    const error = new Error("DeepSeek returned invalid JSON");
    error.code = "INVALID_AI_JSON";
    error.rawResponsePreview = normalizedResponse.slice(0, 500);
    throw error;
  }
}

function normalizeConversation(conversation = []) {
  if (!Array.isArray(conversation)) {
    const error = new Error("messages must be an array");
    error.statusCode = 400;
    throw error;
  }

  return conversation.slice(-MAX_CHAT_HISTORY_MESSAGES).map((message) => {
    const role = message?.role;
    const content = String(message?.content || "").trim();

    if (!["user", "assistant"].includes(role) || !content) {
      const error = new Error("Each message must include a valid role and content");
      error.statusCode = 400;
      throw error;
    }

    return {
      role,
      content: content.slice(0, MAX_CHAT_MESSAGE_LENGTH),
    };
  });
}

function parseCareerExploreChatResponse(rawResponse) {
  const parsed = parseJsonObject(rawResponse);
  const answer = String(parsed.answer || "").trim();
  const suggestedQuestions = Array.isArray(parsed.suggestedQuestions)
    ? parsed.suggestedQuestions
        .map((question) => String(question || "").trim())
        .filter(Boolean)
        .slice(0, MAX_SUGGESTED_QUESTIONS)
    : [];

  if (!answer || suggestedQuestions.length < 3) {
    throw new Error("Career explore chat response is incomplete");
  }

  return {
    answer,
    suggestedQuestions,
    usedWebSearch: parsed.usedWebSearch === true,
  };
}

function shouldSearchVietnamJobMarket(question = "") {
  const normalizedQuestion = String(question).toLocaleLowerCase("vi");
  const marketKeywords = [
    "lương",
    "thu nhập",
    "tuyển dụng",
    "việc làm",
    "thị trường",
    "nhu cầu",
    "cơ hội nghề",
    "xu hướng",
    "doanh nghiệp",
    "job",
    "salary",
  ];

  return marketKeywords.some((keyword) => normalizedQuestion.includes(keyword));
}

module.exports = {
  normalizeConversation,
  parseCareerExploreChatResponse,
  shouldSearchVietnamJobMarket,
};
