function buildCareerFitExplanationMessages({
  career,
  strengthsToExplain,
}) {
  const careerTitle = career.title_vi || career.title_en;
  const strengthList = strengthsToExplain
    .map((strength) => `- ${strength.code}: ${strength.name_vi}`)
    .join("\n");

  return [
    {
      role: "system",
      content: `Bạn là cố vấn hướng nghiệp cho học sinh Việt Nam.
Hãy giải thích ngắn gọn vì sao từng điểm mạnh đã được xác nhận trong hồ sơ phù hợp với nghề đang xem.
Chỉ sử dụng dữ liệu được cung cấp. Không suy diễn thành tích, kinh nghiệm, môn học hoặc hoàn cảnh cá nhân chưa được nêu.
Với mỗi điểm mạnh, viết bằng tiếng Việt tự nhiên, tích cực nhưng không cường điệu, từ 2 đến 4 câu.
Phải trả về đúng một explanation cho mỗi code được cung cấp, giữ nguyên code.
Trả về đúng một JSON object theo schema:
{"explanations":[{"strengthCode":"string","explanation":"string"}]}`,
    },
    {
      role: "user",
      content: `Nghề nghiệp: ${careerTitle}
Mô tả nghề nghiệp: ${career.description_vi || "Chưa có mô tả."}
Các điểm mạnh cần giải thích:
${strengthList}`,
    },
  ];
}

module.exports = { buildCareerFitExplanationMessages };
