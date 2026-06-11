const OpenAI = require("openai");

let deepseek;

function getDeepSeekClient() {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }

  // Khởi tạo lazy để server vẫn boot được khi môi trường local chưa cấu hình DeepSeek.
  if (!deepseek) {
    deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
      maxRetries: 1,
      timeout: 60 * 1000,
    });
  }

  return deepseek;
}

async function callDeepSeek(messages) {
  const completion = await getDeepSeekClient().chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
    messages,
    // DeepSeek yêu cầu truyền thinking qua extra_body khi dùng OpenAI SDK.
    extra_body: {
      thinking: { type: "enabled" },
    },
    reasoning_effort: "high",
    stream: false,
    // Controller cần JSON ổn định để quyết định hỏi tiếp hay chuyển sang xác nhận.
    response_format: { type: "json_object" },
    max_tokens: 10000,
  });

  const choice = completion.choices[0];
  const content = choice?.message?.content;

  if (choice?.finish_reason === "length") {
    throw new Error("DeepSeek JSON response was truncated");
  }

  if (!content) {
    throw new Error("DeepSeek returned an empty response");
  }

  return content;
}

module.exports = { callDeepSeek };
