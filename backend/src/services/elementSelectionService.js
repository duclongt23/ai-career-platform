const Element = require("../models/Element");

const BASE_QUOTA = {
  ability: 22,
  workstyle: 18,
  transferable_skill: 8,
  essential_skill: 6,
  knowledge: 6,
};
const TOTAL_ELEMENT_LIMIT = Object.values(BASE_QUOTA).reduce(
  (total, count) => total + count,
  0
);
const TOP_MATCH_RATIO = 0.7;

const TOPIC_QUOTAS = {
  hands_on_activity: {
    ability: 24,
    workstyle: 14,
    transferable_skill: 8,
    essential_skill: 8,
    knowledge: 6,
  },
  curiosity_research: {
    ability: 20,
    workstyle: 14,
    transferable_skill: 6,
    essential_skill: 6,
    knowledge: 14,
  },
  creative_expression: {
    ability: 22,
    workstyle: 16,
    transferable_skill: 10,
    essential_skill: 6,
    knowledge: 6,
  },
  helping_people: {
    ability: 18,
    workstyle: 22,
    transferable_skill: 10,
    essential_skill: 6,
    knowledge: 4,
  },
  leadership_persuasion: {
    ability: 18,
    workstyle: 20,
    transferable_skill: 12,
    essential_skill: 6,
    knowledge: 4,
  },
  planning_structure: {
    ability: 18,
    workstyle: 22,
    transferable_skill: 6,
    essential_skill: 10,
    knowledge: 4,
  },
  achievement_strength: BASE_QUOTA,
  learning_preference: {
    ability: 20,
    workstyle: 16,
    transferable_skill: 6,
    essential_skill: 6,
    knowledge: 12,
  },
  team_role: {
    ability: 18,
    workstyle: 22,
    transferable_skill: 10,
    essential_skill: 6,
    knowledge: 4,
  },
  motivation_interest: BASE_QUOTA,
};

const TOPIC_TYPE_BOOSTS = {
  hands_on_activity: {
    ability: 0.18,
    essential_skill: 0.12,
    transferable_skill: 0.08,
  },
  curiosity_research: {
    knowledge: 0.22,
    ability: 0.12,
  },
  creative_expression: {
    ability: 0.12,
    transferable_skill: 0.1,
    workstyle: 0.08,
  },
  helping_people: {
    workstyle: 0.18,
    transferable_skill: 0.12,
  },
  leadership_persuasion: {
    transferable_skill: 0.18,
    workstyle: 0.12,
  },
  planning_structure: {
    workstyle: 0.16,
    essential_skill: 0.14,
  },
  achievement_strength: {
    ability: 0.1,
    workstyle: 0.1,
  },
  learning_preference: {
    knowledge: 0.16,
    ability: 0.1,
  },
  team_role: {
    workstyle: 0.14,
    transferable_skill: 0.12,
  },
};

function getTopRiasecLetters(riasecCode, limit = 3) {
  if (!riasecCode) return [];
  return riasecCode
    .toUpperCase()
    .split("")
    .filter((x) => ["R", "I", "A", "S", "E", "C"].includes(x))
    .slice(0, limit);
}

function getRiasecWeight(weights, letter) {
  if (weights instanceof Map) {
    return Number(weights.get(letter) || 0);
  }

  return Number(weights?.[letter] || 0);
}

function getStableUnitInterval(seed, value) {
  const input = `${seed}:${value}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function getQuotaForTopic(openingTopic) {
  return TOPIC_QUOTAS[openingTopic] || BASE_QUOTA;
}

function getTopicTypeBoost(openingTopic, type) {
  return Number(TOPIC_TYPE_BOOSTS[openingTopic]?.[type] || 0);
}

function selectElementsByQuota(elements, { openingTopic, seed } = {}) {
  const quota = getQuotaForTopic(openingTopic);
  const selected = [];
  const selectedCodes = new Set();

  function addElement(element) {
    if (selectedCodes.has(element.code)) {
      return;
    }

    selected.push(element);
    selectedCodes.add(element.code);
  }

  // Mỗi nhóm element lấy phần lớn theo độ liên quan RIASEC/chủ đề, phần còn
  // lại theo random có seed để mở rộng khám phá nhưng không làm phiên bị đổi
  // danh sách giữa các lượt gọi.
  Object.entries(quota).forEach(([type, count]) => {
    const typeElements = elements.filter((element) => element.type === type);
    const ranked = [...typeElements].sort(
      (a, b) => b.selectionScore - a.selectionScore
    );
    const topMatchCount = Math.min(
      ranked.length,
      Math.ceil(count * TOP_MATCH_RATIO)
    );

    ranked.slice(0, topMatchCount).forEach(addElement);

    ranked
      .slice(topMatchCount)
      .sort((a, b) => a.randomScore - b.randomScore)
      .slice(0, count - topMatchCount)
      .forEach(addElement);
  });

  // Bù phần thiếu khi một nhóm không đủ element active/student_suitable.
  if (selected.length < TOTAL_ELEMENT_LIMIT) {
    elements
      .filter((element) => !selectedCodes.has(element.code))
      .sort((a, b) => b.selectionScore - a.selectionScore)
      .slice(0, TOTAL_ELEMENT_LIMIT - selected.length)
      .forEach(addElement);
  }

  return selected.sort((a, b) => b.selectionScore - a.selectionScore);
}

async function getElementsForAiDiscovery(profile, options = {}) {
  const topRiasec = getTopRiasecLetters(profile.riasecCode, 3);
  const seed = String(options.seed || profile.userId || profile._id || "ai-discovery");

  const elements = await Element.find({
    is_active: true,
    student_suitable: true,
  })
    .select(
      "code type name_vi name_en student_friendly_description description_vi riasec_tags riasec_weights"
    )
    .lean();

  const scored = elements
    .map((el) => {
      const riasecScore = topRiasec.reduce((sum, letter) => {
        return sum + getRiasecWeight(el.riasec_weights, letter);
      }, 0);
      const topicBoost = getTopicTypeBoost(options.openingTopic, el.type);
      const randomScore = getStableUnitInterval(seed, el.code);

      return {
        ...el,
        riasecScore,
        topicBoost,
        randomScore,
        selectionScore: riasecScore + topicBoost + randomScore * 0.03,
      };
    })
    .filter((element) => !options.excludedCodes?.has(String(element.code).toLowerCase()));

  return selectElementsByQuota(scored, {
    openingTopic: options.openingTopic,
    seed,
  });
}

module.exports = {
  getElementsForAiDiscovery,
  getQuotaForTopic,
  selectElementsByQuota,
};
