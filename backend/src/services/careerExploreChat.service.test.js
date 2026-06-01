const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeConversation,
  parseCareerExploreChatResponse,
  shouldSearchVietnamJobMarket,
} = require("./careerExploreChat.service");
const {
  buildCareerExploreChatMessages,
} = require("../prompts/careerExploreChat");

test("parseCareerExploreChatResponse accepts a complete JSON response", () => {
  assert.deepEqual(
    parseCareerExploreChatResponse(
      '```json\n{"answer":"Nội dung trả lời.","suggestedQuestions":["Câu 1?","Câu 2?","Câu 3?"],"usedWebSearch":true}\n```'
    ),
    {
      answer: "Nội dung trả lời.",
      suggestedQuestions: ["Câu 1?", "Câu 2?", "Câu 3?"],
      usedWebSearch: true,
    }
  );
});

test("parseCareerExploreChatResponse extracts JSON surrounded by extra text", () => {
  assert.equal(
    parseCareerExploreChatResponse(
      'Kết quả:\n{"answer":"Nội dung trả lời.","suggestedQuestions":["Câu 1?","Câu 2?","Câu 3?"]}\nHoàn tất.'
    ).answer,
    "Nội dung trả lời."
  );
});

test("parseCareerExploreChatResponse reports invalid JSON with a preview", () => {
  assert.throws(
    () => parseCareerExploreChatResponse("not-json"),
    (error) =>
      error.code === "INVALID_AI_JSON" &&
      error.rawResponsePreview === "not-json"
  );
});

test("parseCareerExploreChatResponse rejects fewer than three suggestions", () => {
  assert.throws(() =>
    parseCareerExploreChatResponse(
      '{"answer":"Nội dung trả lời.","suggestedQuestions":["Câu 1?","Câu 2?"]}'
    )
  );
});

test("normalizeConversation keeps only recent valid messages", () => {
  const conversation = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `Tin nhắn ${index}`,
  }));

  const normalizedConversation = normalizeConversation(conversation);

  assert.equal(normalizedConversation.length, 10);
  assert.equal(normalizedConversation[0].content, "Tin nhắn 2");
});

test("shouldSearchVietnamJobMarket detects questions that need current market data", () => {
  assert.equal(
    shouldSearchVietnamJobMarket("Nhu cầu tuyển dụng nghề này ở Việt Nam thế nào?"),
    true
  );
  assert.equal(
    shouldSearchVietnamJobMarket("Tôi nên học kỹ năng nào đầu tiên?"),
    false
  );
});

test("buildCareerExploreChatMessages includes profile, career and web context", () => {
  const messages = buildCareerExploreChatMessages({
    career: {
      title_vi: "Lập trình viên",
      title_en: "Software Developer",
      careerCluster: "Công nghệ thông tin",
      description_vi: "Xây dựng và bảo trì phần mềm.",
    },
    profile: {
      grade: 12,
      riasecCode: "IRC",
      favoriteSubjects: ["Tin học"],
    },
    topElements: [{ code: "programming", name_vi: "Lập trình" }],
    searchResults: [
      {
        title: "Báo cáo tuyển dụng",
        url: "https://example.com/report",
        content: "Nội dung báo cáo.",
      },
    ],
  });

  assert.match(messages[1].content, /Lập trình viên/);
  assert.match(messages[1].content, /Tin học/);
  assert.match(messages[1].content, /Báo cáo tuyển dụng/);
});
