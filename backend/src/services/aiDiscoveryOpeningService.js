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

function buildAiDiscoveryOpeningMessage(profile) {
  const primaryRiasecLetter = getPrimaryRiasecLetter(profile);
  return RIASEC_OPENING_MESSAGES[primaryRiasecLetter];
}

module.exports = {
  buildAiDiscoveryOpeningMessage,
  getPrimaryRiasecLetter,
};
