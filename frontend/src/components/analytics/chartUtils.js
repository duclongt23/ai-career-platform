export const RIASEC_TYPES = [
  "REALISTIC",
  "INVESTIGATIVE",
  "ARTISTIC",
  "SOCIAL",
  "ENTERPRISING",
  "CONVENTIONAL",
];

const RIASEC_INFO = {
  REALISTIC: {
    code: "R",
    label: "Kỹ thuật",
    description:
      "Thích thao tác với công cụ, máy móc, vật thể hoặc các hoạt động thực tế.",
  },
  INVESTIGATIVE: {
    code: "I",
    label: "Nghiên cứu",
    description:
      "Thích quan sát, phân tích và giải quyết vấn đề bằng dữ liệu hoặc lập luận.",
  },
  ARTISTIC: {
    code: "A",
    label: "Nghệ thuật",
    description:
      "Thích sáng tạo, diễn đạt ý tưởng và làm việc trong môi trường linh hoạt.",
  },
  SOCIAL: {
    code: "S",
    label: "Xã hội",
    description:
      "Thích hỗ trợ, hướng dẫn, chăm sóc hoặc làm việc trực tiếp với con người.",
  },
  ENTERPRISING: {
    code: "E",
    label: "Quản lý",
    description:
      "Thích thuyết phục, lãnh đạo, tổ chức nguồn lực và tạo ảnh hưởng.",
  },
  CONVENTIONAL: {
    code: "C",
    label: "Nghiệp vụ",
    description:
      "Thích quy trình rõ ràng, dữ liệu, con số và các nhiệm vụ cần chính xác.",
  },
};

export const CORE_TYPE_LABELS = {
  ability: "Năng lực",
  workstyle: "Phong cách",
  essential_skill: "Kỹ năng nền tảng",
  transferable_skill: "Kỹ năng chuyển đổi",
  knowledge: "Kiến thức",
};

export const CORE_TYPE_COLORS = {
  ability: "#7c3aed",
  workstyle: "#f97316",
  essential_skill: "#16a34a",
  transferable_skill: "#0d9488",
  knowledge: "#2563eb",
};

export const getElementDisplayName = (score) =>
  score.name_vi || score.name_en || score.name || score.code;

export function buildRiasecResults(
  riasecScores = {},
  riasecCode = "",
  questions = []
) {
  const counts = RIASEC_TYPES.reduce(
    (result, type) => ({ ...result, [type]: 0 }),
    {}
  );
  const codeOrder = String(riasecCode || "")
    .toUpperCase()
    .split("")
    .reduce((order, code, index) => ({ ...order, [code]: index }), {});

  questions.forEach((question) => {
    if (counts[question.type] !== undefined) {
      counts[question.type] += 1;
    }
  });

  return RIASEC_TYPES.map((type) => {
    const score = Number(riasecScores?.[type] || 0);
    const maxScore = counts[type] * 4 || 20;
    const percent = Math.round((score / maxScore) * 100);

    return {
      type,
      score,
      maxScore,
      percent: Math.max(0, Math.min(percent, 100)),
      ...RIASEC_INFO[type],
    };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aOrder = codeOrder[a.code] ?? RIASEC_TYPES.length;
    const bOrder = codeOrder[b.code] ?? RIASEC_TYPES.length;
    return aOrder - bOrder;
  });
}
