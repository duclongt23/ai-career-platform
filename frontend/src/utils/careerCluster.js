export const CAREER_CLUSTER_TRANSLATIONS = {
  Advanced_Manufacturing: "Sản xuất tiên tiến",
  Agriculture: "Nông nghiệp",
  Arts_Entertainment_Design: "Nghệ thuật, giải trí và thiết kế",
  Construction: "Xây dựng",
  Digital_Technology: "Công nghệ số",
  Education: "Giáo dục",
  Energy_Natural_Resources: "Năng lượng và tài nguyên thiên nhiên",
  Financial_Services: "Dịch vụ tài chính",
  Healthcare_Human_Services: "Y tế và dịch vụ xã hội",
  Hospitality_Events_Tourism: "Khách sạn, sự kiện và du lịch",
  Management_Entrepreneurship: "Quản lý và khởi nghiệp",
  Marketing_Sales: "Tiếp thị và bán hàng",
  Public_Service_Safety: "Dịch vụ công và an toàn",
  Supply_Chain_Transportation: "Chuỗi cung ứng và vận tải",
};

export const CAREER_CLUSTER_OPTIONS = Object.values(CAREER_CLUSTER_TRANSLATIONS);

export function normalizeCareerClusters(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[;\n]/)
        .map((item) => item.trim());
  const seen = new Set();

  return values
    .map((item) => String(item || "").trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });
}

export function formatCareerClusters(value, fallback = "") {
  const clusters = normalizeCareerClusters(value);

  return clusters.length ? clusters.join(", ") : fallback;
}
