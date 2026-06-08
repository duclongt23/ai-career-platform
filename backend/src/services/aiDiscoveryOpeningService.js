const RIASEC_OPENING_MESSAGES = {
  R: `Có vẻ em khá hứng thú với những việc thực tế, được bắt tay vào làm và nhìn thấy kết quả rõ ràng.

Có hoạt động nào em từng thích vì được tự tay làm hoặc sửa một thứ gì đó không?`,
  I: `Có vẻ em khá thích tìm hiểu và khám phá cách mọi thứ hoạt động.

Có hoạt động nào em từng rất thích vì được tự tìm hiểu hoặc thử cách làm riêng không?`,
  A: `Có vẻ em khá thích những thứ mang tính sáng tạo hoặc thể hiện cá tính riêng.

Có hoạt động nào em từng làm mà cảm thấy rất "đúng chất mình" không?`,
  S: `Có vẻ em khá thích làm việc với con người hoặc tạo ảnh hưởng tích cực tới người khác.

Có trải nghiệm nào em từng cảm thấy rất vui vì đã giúp được ai đó không?`,
  E: `Có vẻ em khá thích chủ động dẫn dắt, thuyết phục hoặc biến ý tưởng thành kết quả.

Có lần nào em từng hào hứng khi đứng ra tổ chức hoặc kéo mọi người cùng làm một việc không?`,
  C: `Có vẻ em khá thoải mái khi mọi thứ rõ ràng, có cách sắp xếp và tiến độ cụ thể.

Có hoạt động nào em từng thích vì được lên kế hoạch hoặc sắp xếp mọi thứ gọn gàng không?`,
};

const OPENING_QUESTION_CATALOG = [
  {
    id: "riasec-realistic-hands-on",
    topic: "hands_on_activity",
    riasec: "R",
    title: "Từ việc tự tay làm",
    question:
      "Có hoạt động nào em từng thích vì được tự tay làm, sửa, lắp ráp hoặc tạo ra thứ gì đó cụ thể không?",
    message: RIASEC_OPENING_MESSAGES.R,
  },
  {
    id: "riasec-investigative-curiosity",
    topic: "curiosity_research",
    riasec: "I",
    title: "Từ điều em tò mò",
    question:
      "Có chủ đề hoặc vấn đề nào em từng muốn tự tìm hiểu sâu vì thấy nó thật sự cuốn hút không?",
    message: RIASEC_OPENING_MESSAGES.I,
  },
  {
    id: "riasec-artistic-creation",
    topic: "creative_expression",
    riasec: "A",
    title: "Từ lúc em sáng tạo",
    question:
      "Có sản phẩm, bài làm hoặc ý tưởng nào em từng thấy rất đúng chất riêng của mình không?",
    message: RIASEC_OPENING_MESSAGES.A,
  },
  {
    id: "riasec-social-helping",
    topic: "helping_people",
    riasec: "S",
    title: "Từ trải nghiệm giúp người khác",
    question:
      "Có lần nào em thấy vui hoặc có ý nghĩa vì đã giúp, hướng dẫn hoặc lắng nghe ai đó không?",
    message: RIASEC_OPENING_MESSAGES.S,
  },
  {
    id: "riasec-enterprising-leading",
    topic: "leadership_persuasion",
    riasec: "E",
    title: "Từ lần em dẫn dắt",
    question:
      "Có lần nào em hào hứng khi đứng ra tổ chức, thuyết phục hoặc kéo mọi người cùng làm một việc không?",
    message: RIASEC_OPENING_MESSAGES.E,
  },
  {
    id: "riasec-conventional-planning",
    topic: "planning_structure",
    riasec: "C",
    title: "Từ việc sắp xếp rõ ràng",
    question:
      "Có hoạt động nào em từng thích vì được lên kế hoạch, phân loại hoặc làm mọi thứ gọn gàng hơn không?",
    message: RIASEC_OPENING_MESSAGES.C,
  },
  {
    id: "neutral-proud-moment",
    topic: "achievement_strength",
    title: "Từ một lần em tự hào",
    question:
      "Kể về một lần em thấy tự hào về cách mình xử lý một việc. Khi đó em đã làm gì?",
    message: `Mình có thể bắt đầu từ một trải nghiệm rất cụ thể của em.

Kể về một lần em thấy tự hào về cách mình xử lý một việc. Khi đó em đã làm gì?`,
  },
  {
    id: "neutral-easy-subject",
    topic: "learning_preference",
    title: "Từ môn học em thấy dễ vào",
    question:
      "Có môn học hoặc dạng bài nào em thường thấy dễ tập trung hơn những môn khác không?",
    message: `Mình có thể bắt đầu từ cách em học và tiếp nhận kiến thức.

Có môn học hoặc dạng bài nào em thường thấy dễ tập trung hơn những môn khác không?`,
  },
  {
    id: "neutral-team-role",
    topic: "team_role",
    title: "Từ vai trò trong nhóm",
    question:
      "Khi làm việc nhóm, em thường tự nhiên nhận vai trò gì: nghĩ ý tưởng, làm phần chính, điều phối, kiểm tra, hay hỗ trợ người khác?",
    message: `Mình có thể bắt đầu từ cách em phối hợp với người khác.

Khi làm việc nhóm, em thường tự nhiên nhận vai trò gì: nghĩ ý tưởng, làm phần chính, điều phối, kiểm tra, hay hỗ trợ người khác?`,
  },
  {
    id: "neutral-free-day",
    topic: "motivation_interest",
    title: "Từ một ngày rảnh",
    question:
      "Nếu có một ngày rảnh và không bị chấm điểm, em muốn dành thời gian để làm, học, tạo ra hoặc thử điều gì?",
    message: `Mình có thể bắt đầu từ điều em tự muốn chọn khi không bị chấm điểm.

Nếu có một ngày rảnh, em muốn dành thời gian để làm, học, tạo ra hoặc thử điều gì?`,
  },
];

const RIASEC_SCORE_KEYS = {
  R: "REALISTIC",
  I: "INVESTIGATIVE",
  A: "ARTISTIC",
  S: "SOCIAL",
  E: "ENTERPRISING",
  C: "CONVENTIONAL",
};

function getPrimaryRiasecLetter(profile) {
  // riasecCode đã được xếp theo độ nổi trội khi lưu kết quả bài test.
  const codeLetter = String(profile.riasecCode || "")
    .toUpperCase()
    .split("")
    .find((letter) => RIASEC_OPENING_MESSAGES[letter]);

  if (codeLetter) {
    return codeLetter;
  }

  // Fallback cho dữ liệu cũ chưa có riasecCode nhưng vẫn còn bảng điểm RIASEC.
  return Object.entries(RIASEC_SCORE_KEYS).reduce(
    (bestLetter, [letter, scoreKey]) => {
      const score = Number(profile.riasecScores?.[scoreKey] || 0);
      const bestScore = Number(
        profile.riasecScores?.[RIASEC_SCORE_KEYS[bestLetter]] || 0
      );

      return score > bestScore ? letter : bestLetter;
    },
    "R"
  );
}

function getOpeningQuestionById(openingQuestionId) {
  return OPENING_QUESTION_CATALOG.find(
    (option) => option.id === openingQuestionId
  );
}

function getDefaultOpeningQuestion(profile) {
  const primaryRiasecLetter = getPrimaryRiasecLetter(profile);

  return (
    OPENING_QUESTION_CATALOG.find(
      (option) => option.riasec === primaryRiasecLetter
    ) || OPENING_QUESTION_CATALOG[0]
  );
}

function getAiDiscoveryOpeningOptions(profile) {
  const riasecOrder = String(profile.riasecCode || "")
    .toUpperCase()
    .split("")
    .filter((letter) => RIASEC_OPENING_MESSAGES[letter]);
  const preferredRiasec = new Set(riasecOrder.slice(0, 3));

  // Đưa lựa chọn theo top RIASEC lên trước, sau đó vẫn cho học sinh chọn
  // các câu trung tính để tránh cuộc trò chuyện bị khóa cứng bởi một mã test.
  return OPENING_QUESTION_CATALOG.map((option) => ({
    ...option,
    isRecommended: option.riasec ? preferredRiasec.has(option.riasec) : false,
  })).sort((a, b) => {
    if (a.isRecommended !== b.isRecommended) {
      return a.isRecommended ? -1 : 1;
    }

    const aIndex = a.riasec ? riasecOrder.indexOf(a.riasec) : 99;
    const bIndex = b.riasec ? riasecOrder.indexOf(b.riasec) : 99;

    return aIndex - bIndex;
  });
}

function buildAiDiscoveryOpeningMessage(profile, openingQuestionId) {
  const openingQuestion =
    getOpeningQuestionById(openingQuestionId) || getDefaultOpeningQuestion(profile);

  return openingQuestion.message;
}

module.exports = {
  getAiDiscoveryOpeningOptions,
  getDefaultOpeningQuestion,
  getOpeningQuestionById,
  buildAiDiscoveryOpeningMessage,
  getPrimaryRiasecLetter,
};
