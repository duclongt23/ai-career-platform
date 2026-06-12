function buildCareerRoadmapMessages({ career, keyElements = [] }) {
  const careerTitle = career.title_vi || career.title_en;
  const elementList =
    keyElements.length > 0
      ? keyElements
          .slice(0, 8)
          .map((element) => {
            const name = element.name_vi || element.name_en || element.code;
            const importance = Math.round(Number(element.importance || 0) * 100);

            return `- ${name}: mức độ quan trọng ${importance}%`;
          })
          .join("\n")
      : "- Chưa có dữ liệu kỹ năng trọng tâm.";

  return [
    {
      role: "system",
      content: `Bạn là cố vấn hướng nghiệp cho học sinh THPT Việt Nam.
Hãy tạo roadmap học tập và trải nghiệm để học sinh hình dung đường đi tới nghề được cung cấp.
Yêu cầu nội dung:
- Viết bằng tiếng Việt tự nhiên, rõ ràng, thân thiện với học sinh lớp 10-12.
- Roadmap phải có 5 đến 6 giai đoạn, đi từ tìm hiểu ban đầu đến chuẩn bị bước sau THPT.
- Mỗi giai đoạn phải cụ thể và hành động được: môn học nên chú ý, kỹ năng nên rèn, dự án nhỏ, CLB/cuộc thi/trải nghiệm, portfolio hoặc bước ra quyết định.
- Không bịa tên trường, tên công ty, chứng chỉ bắt buộc, mức lương, cam kết đầu vào/đầu ra, hoặc yêu cầu không có trong dữ liệu.
- Không khuyên học sinh chọn duy nhất một con đường; hãy giữ roadmap linh hoạt và phù hợp với bối cảnh Việt Nam.
Giới hạn:
- summary tối đa 180 ký tự.
- title tối đa 48 ký tự.
- timeframe tối đa 32 ký tự.
- focus tối đa 120 ký tự.
- mỗi action tối đa 90 ký tự, mỗi giai đoạn có 2 đến 3 actions.
- checkpoint tối đa 110 ký tự.
Trả về đúng một JSON object theo schema:
{"summary":"string","phases":[{"id":"lowercase-hyphen-id","title":"string","timeframe":"string","focus":"string","actions":["string"],"checkpoint":"string"}]}`,
    },
    {
      role: "user",
      content: `Nghề nghiệp: ${careerTitle}
Mô tả nghề nghiệp: ${career.description_vi || "Chưa có mô tả."}
Nhóm ngành: ${(career.careerCluster || []).join(", ") || "Chưa rõ"}
Mã RIASEC: ${career.riasecCode || "Chưa có"}
Kỹ năng/năng lực trọng tâm:
${elementList}`,
    },
  ];
}

module.exports = { buildCareerRoadmapMessages };
