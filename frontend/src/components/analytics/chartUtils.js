export const RIASEC_TYPES = [
  "REALISTIC",
  "INVESTIGATIVE",
  "ARTISTIC",
  "SOCIAL",
  "ENTERPRISING",
  "CONVENTIONAL",
];

const RIASEC_INFO = {
  REALISTIC: { code: "R", label: "Ky thuat" },
  INVESTIGATIVE: { code: "I", label: "Nghien cuu" },
  ARTISTIC: { code: "A", label: "Nghe thuat" },
  SOCIAL: { code: "S", label: "Xa hoi" },
  ENTERPRISING: { code: "E", label: "Quan ly" },
  CONVENTIONAL: { code: "C", label: "Nghiep vu" },
};

export const CORE_TYPE_LABELS = {
  ability: "Nang luc",
  workstyle: "Phong cach",
  essential_skill: "Ky nang nen tang",
  transferable_skill: "Ky nang chuyen doi",
  knowledge: "Kien thuc",
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
