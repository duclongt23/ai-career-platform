const Element = require("../models/Element");

const QUOTA = {
  ability: 22,
  workstyle: 18,
  transferable_skill: 8,
  essential_skill: 6,
  knowledge: 6,
};
const TOTAL_ELEMENT_LIMIT = Object.values(QUOTA).reduce(
  (total, count) => total + count,
  0
);

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

function selectElementsByQuota(sortedElements) {
  const selected = [];
  const selectedCodes = new Set();

  function addElement(element) {
    if (selectedCodes.has(element.code)) {
      return;
    }

    selected.push(element);
    selectedCodes.add(element.code);
  }

  // Giữ độ phủ giữa các nhóm element thay vì để một nhóm chiếm toàn bộ prompt.
  Object.entries(QUOTA).forEach(([type, count]) => {
    sortedElements
      .filter((element) => element.type === type)
      .slice(0, count)
      .forEach(addElement);
  });

  // Bù phần thiếu khi một nhóm không có đủ element phù hợp với RIASEC.
  if (selected.length < TOTAL_ELEMENT_LIMIT) {
    sortedElements
      .filter((element) => !selectedCodes.has(element.code))
      .slice(0, TOTAL_ELEMENT_LIMIT - selected.length)
      .forEach(addElement);
  }

  return selected.sort((a, b) => b.riasecScore - a.riasecScore);
}

async function getElementsForAiDiscovery(profile) {
  const topRiasec = getTopRiasecLetters(profile.riasecCode, 3);

  const matched = await Element.find({
    is_active: true,
    student_suitable: true,
    riasec_tags: { $in: topRiasec },
  })
    .select(
      "code type name_vi name_en student_friendly_description description_vi riasec_tags riasec_weights"
    )
    .lean();

  const sorted = matched
    .map((el) => {
      const riasecScore = topRiasec.reduce((sum, letter) => {
        return sum + getRiasecWeight(el.riasec_weights, letter);
      }, 0);

      return { ...el, riasecScore };
    })
    .sort((a, b) => b.riasecScore - a.riasecScore);

  return selectElementsByQuota(sorted);
}

module.exports = {
  getElementsForAiDiscovery,
};
