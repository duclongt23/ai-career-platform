const SCORE_DISPLAY_FALLBACK = "Chưa đủ dữ liệu";

const COMPETENCY_GROUPS = [
  {
    id: "analytical_thinking",
    label: "Tư duy phân tích",
    description: "Quan sát, suy luận, xử lý dữ liệu và giải quyết vấn đề.",
    keywords: [
      "analysis",
      "analytical",
      "critical",
      "reasoning",
      "problem",
      "logic",
      "mathemat",
      "science",
      "data",
      "comput",
      "program",
      "information ordering",
    ],
  },
  {
    id: "communication",
    label: "Giao tiếp",
    description: "Diễn đạt, lắng nghe, viết, thuyết phục và trao đổi thông tin.",
    keywords: [
      "communication",
      "speaking",
      "listening",
      "writing",
      "oral",
      "written",
      "persuasion",
      "negotiation",
      "customer",
      "service",
      "instruct",
      "presentation",
    ],
  },
  {
    id: "creativity",
    label: "Sáng tạo",
    description: "Tạo ý tưởng, thiết kế, hình dung và tìm cách làm mới.",
    keywords: [
      "creative",
      "creativity",
      "originality",
      "fluency of ideas",
      "design",
      "fine arts",
      "artistic",
      "innovation",
      "visualization",
      "media",
    ],
  },
  {
    id: "teamwork",
    label: "Làm việc nhóm",
    description: "Phối hợp, hỗ trợ, lãnh đạo và làm việc hiệu quả với người khác.",
    keywords: [
      "team",
      "cooperation",
      "coordination",
      "social",
      "leadership",
      "concern for others",
      "collaboration",
      "personnel",
      "human resources",
      "training",
      "counseling",
    ],
  },
  {
    id: "self_learning",
    label: "Tự học",
    description: "Chủ động học, thích nghi, kiên trì và cải thiện bản thân.",
    keywords: [
      "learning",
      "active learning",
      "learning strategies",
      "initiative",
      "persistence",
      "adaptability",
      "independence",
      "achievement",
      "curiosity",
    ],
  },
  {
    id: "organization_discipline",
    label: "Tổ chức và kỷ luật",
    description: "Lập kế hoạch, chú ý chi tiết, ổn định và theo sát quy trình.",
    keywords: [
      "organization",
      "organizing",
      "planning",
      "administrative",
      "detail",
      "dependability",
      "integrity",
      "attention",
      "time",
      "scheduling",
      "conventional",
      "monitoring",
    ],
  },
];

export function formatElementCode(code) {
  return String(code || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getSummaryElementName(element) {
  return (
    element?.name_vi ||
    element?.name_en ||
    element?.name ||
    formatElementCode(element?.code)
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getElementSearchText(element) {
  return normalizeText(
    [
      element?.code,
      element?.name_vi,
      element?.name_en,
      element?.name,
      element?.type,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getGroupMatches(scores, group) {
  return scores
    .filter((score) => {
      const searchText = getElementSearchText(score);

      return group.keywords.some((keyword) =>
        searchText.includes(normalizeText(keyword))
      );
    })
    .sort((a, b) => Number(b.finalScore || 0) - Number(a.finalScore || 0));
}

export function buildCompetencyGroups(scores = []) {
  return COMPETENCY_GROUPS.map((group) => {
    const matches = getGroupMatches(scores, group).slice(0, 8);
    const score =
      matches.length > 0
        ? matches.reduce(
            (sum, element) => sum + Number(element.finalScore || 0),
            0
          ) / matches.length
        : null;

    return {
      ...group,
      score,
      scoreLabel:
        score == null ? SCORE_DISPLAY_FALLBACK : `${Math.round(score * 100)}%`,
      matchedElements: matches.slice(0, 3),
    };
  });
}

export function buildDevelopmentAreas({ recommendations = [], limit = 5 } = {}) {
  const areaMap = new Map();

  recommendations.slice(0, 8).forEach((career, careerIndex) => {
    const careerTitle = career.title_vi || career.title_en;

    (career.growthElements || []).forEach((element) => {
      const code = String(element.code || "").trim();

      if (!code) {
        return;
      }

      if (!areaMap.has(code)) {
        areaMap.set(code, {
          code,
          type: element.type,
          name: getSummaryElementName(element),
          totalGap: 0,
          totalImportance: 0,
          totalProfileScore: 0,
          count: 0,
          careerTitles: [],
          bestCareerRank: careerIndex + 1,
        });
      }

      const area = areaMap.get(code);
      const careerImportance = Number(element.careerImportance || 0);
      const profileScore = Number(element.profileScore || 0);
      const gap = Number(element.gap || careerImportance - profileScore || 0);

      area.totalGap += Math.max(gap, 0);
      area.totalImportance += careerImportance;
      area.totalProfileScore += profileScore;
      area.count += 1;

      if (careerTitle && !area.careerTitles.includes(careerTitle)) {
        area.careerTitles.push(careerTitle);
      }

      area.bestCareerRank = Math.min(area.bestCareerRank, careerIndex + 1);
    });
  });

  // Ưu tiên element xuất hiện ở nhiều nghề gợi ý, có gap lớn và nằm trong các nghề rank cao.
  return [...areaMap.values()]
    .map((area) => ({
      ...area,
      averageGap: area.totalGap / area.count,
      averageImportance: area.totalImportance / area.count,
      averageProfileScore: area.totalProfileScore / area.count,
      careerTitles: area.careerTitles.slice(0, 3),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.averageGap - a.averageGap ||
        a.bestCareerRank - b.bestCareerRank ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}
