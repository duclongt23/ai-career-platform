function buildProfileSummaryInsightMessages({ context }) {
  return [
    {
      role: "system",
      content: `Bạn là cố vấn hướng nghiệp cho học sinh THPT Việt Nam.
Hãy viết 3-5 insight tổng quan về hồ sơ học sinh dựa đúng trên dữ liệu được cung cấp.

Nguyên tắc:
- Viết bằng tiếng Việt tự nhiên, rõ ràng, phù hợp với học sinh.
- Không gọi là điểm yếu, không phán xét tính cách cố định.
- Không tự suy diễn thành tích, hoàn cảnh gia đình, sức khỏe, giới tính hoặc năng lực chưa có trong dữ liệu.
- Mỗi insight gồm title ngắn và description 1-2 câu.
- Ưu tiên kết hợp nhiều tín hiệu: RIASEC, element nổi bật, nhóm ngành và nghề gợi ý.

Trả về đúng một JSON object theo schema:
{"insights":[{"title":"string","description":"string"}]}`,
    },
    {
      role: "user",
      content: JSON.stringify(context),
    },
  ];
}

module.exports = { buildProfileSummaryInsightMessages };
