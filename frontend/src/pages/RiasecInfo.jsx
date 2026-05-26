import { Link } from "react-router-dom";

const RIASEC_GROUPS = [
  {
    code: "R",
    title: "Realistic - Kỹ thuật",
    text: "Phù hợp với người thích thao tác trực tiếp với công cụ, máy móc, vật thể, cây cối, động vật hoặc các hoạt động thực tế.",
  },
  {
    code: "I",
    title: "Investigative - Nghiên cứu",
    text: "Phù hợp với người thích quan sát, phân tích, tìm hiểu nguyên nhân và giải quyết vấn đề bằng dữ liệu hoặc lập luận.",
  },
  {
    code: "A",
    title: "Artistic - Nghệ thuật",
    text: "Phù hợp với người thích sáng tạo, diễn đạt ý tưởng, thiết kế, viết, biểu diễn hoặc làm việc trong môi trường linh hoạt.",
  },
  {
    code: "S",
    title: "Social - Xã hội",
    text: "Phù hợp với người thích hỗ trợ, hướng dẫn, chăm sóc, đào tạo hoặc làm việc trực tiếp với con người.",
  },
  {
    code: "E",
    title: "Enterprising - Quản lý",
    text: "Phù hợp với người thích thuyết phục, lãnh đạo, kinh doanh, tổ chức nguồn lực và tạo ảnh hưởng đến người khác.",
  },
  {
    code: "C",
    title: "Conventional - Nghiệp vụ",
    text: "Phù hợp với người thích công việc có quy trình, dữ liệu, con số, hồ sơ và các nhiệm vụ cần sự chính xác.",
  },
];

function RiasecInfo() {
  return (
    <div className="riasec-page">
      <section className="riasec-intro-hero">
        <div>
          <p className="riasec-eyebrow">Holland Code</p>
          <h1>RIASEC là gì?</h1>
          <p>
            RIASEC là mô hình giúp mô tả sở thích nghề nghiệp qua 6 nhóm chính:
            Realistic, Investigative, Artistic, Social, Enterprising và
            Conventional. Kết quả thường được biểu diễn bằng 3 chữ cái nổi bật
            nhất, ví dụ như SAE, RIS hoặc AEC.
          </p>
        </div>
        <Link className="riasec-primary-link" to="/riasec-test">
          Làm bài test
        </Link>
      </section>

      <section className="riasec-intro-panel background">
        <h2>Dùng RIASEC để làm gì?</h2>
        <p>
          RIASEC giúp người học nhìn rõ kiểu hoạt động mình quan tâm, từ đó có
          thêm cơ sở để khám phá ngành học, nghề nghiệp và môi trường làm việc
          phù hợp. Đây là công cụ định hướng tham khảo, không phải kết luận bắt
          buộc về năng lực hay tương lai nghề nghiệp.
        </p>
      </section>

      <section className="riasec-type-grid" aria-label="Sáu nhóm RIASEC">
        {RIASEC_GROUPS.map((group) => (
          <article className="riasec-type-card" key={group.code}>
            <span>{group.code}</span>
            <h3>{group.title}</h3>
            <p>{group.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export default RiasecInfo;
