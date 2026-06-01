function buildCareerDayInLifeMessages({ career }) {
  const careerTitle = career.title_vi || career.title_en;

  return [
    {
      role: "system",
      content: `Bạn là cố vấn hướng nghiệp cho học sinh Việt Nam.
Hãy mô tả một ngày làm việc điển hình của nghề được cung cấp bằng danh sách hoạt động theo trình tự hợp lý.
Chỉ sử dụng dữ liệu nghề nghiệp được cung cấp và kiến thức nghề nghiệp phổ biến. Không bịa đặt tên công ty, địa điểm hoặc hoàn cảnh cá nhân.
Viết bằng tiếng Việt tự nhiên, rõ ràng, mỗi hoạt động là một câu ngắn gọn.
Trả về từ 5 đến 7 hoạt động.
Trả về đúng một JSON object theo schema:
{"activities":["string"]}`,
    },
    {
      role: "user",
      content: `Nghề nghiệp: ${careerTitle}
Mô tả nghề nghiệp: ${career.description_vi || "Chưa có mô tả."}`,
    },
  ];
}

module.exports = { buildCareerDayInLifeMessages };
