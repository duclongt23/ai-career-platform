const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findCachedCareerFitExplanation,
  parseCareerFitExplanations,
  selectCareerStrength,
} = require("../../src/services/careerFitExplanation.service");
const {
  buildCareerFitExplanationMessages,
} = require("../../src/prompts/careerFitExplanationPrompt");

const strengths = [
  { code: "critical_thinking", name_vi: "Tư duy phản biện" },
  { code: "active_listening", name_vi: "Lắng nghe chủ động" },
];

test("selectCareerStrength defaults to the strongest matched element", () => {
  assert.equal(selectCareerStrength(strengths).code, "critical_thinking");
});

test("selectCareerStrength rejects an element outside the matched strengths", () => {
  assert.throws(
    () => selectCareerStrength(strengths, "programming"),
    (error) =>
      error.statusCode === 400 &&
      error.message === "selectedStrengthCode must be a matched strength"
  );
});

test("parseCareerFitExplanations accepts a complete batch wrapped in a markdown fence", () => {
  assert.deepEqual(
    parseCareerFitExplanations(
      '```json\n{"explanations":[{"strengthCode":"critical_thinking","explanation":"Hỗ trợ phân tích."},{"strengthCode":"active_listening","explanation":"Hỗ trợ lắng nghe."}]}\n```',
      ["critical_thinking", "active_listening"]
    ),
    {
      critical_thinking: "Hỗ trợ phân tích.",
      active_listening: "Hỗ trợ lắng nghe.",
    }
  );
});

test("buildCareerFitExplanationMessages includes career and strength context", () => {
  const messages = buildCareerFitExplanationMessages({
    career: {
      title_vi: "Chuyên viên tư vấn",
      description_vi: "Hỗ trợ khách hàng lựa chọn giải pháp phù hợp.",
    },
    strengthsToExplain: strengths,
  });

  assert.match(messages[1].content, /Chuyên viên tư vấn/);
  assert.match(messages[1].content, /Tư duy phản biện/);
  assert.match(messages[1].content, /Lắng nghe chủ động/);
});

test("parseCareerFitExplanations rejects an incomplete batch", () => {
  assert.throws(() =>
    parseCareerFitExplanations(
      '{"explanations":[{"strengthCode":"critical_thinking","explanation":"Hỗ trợ phân tích."}]}',
      ["critical_thinking", "active_listening"]
    )
  );
});

test("findCachedCareerFitExplanation returns only a current profile and career match", () => {
  const currentCareerUpdatedAt = new Date("2026-06-01T00:00:00.000Z");
  const cachedExplanation = {
    careerId: "career-1",
    strengthCode: "critical_thinking",
    elementScoresFingerprint: "profile-v1",
    careerUpdatedAt: currentCareerUpdatedAt,
    explanation: "Phù hợp.",
  };

  assert.equal(
    findCachedCareerFitExplanation([cachedExplanation], {
      careerId: "career-1",
      strengthCode: "critical_thinking",
      elementScoresFingerprint: "profile-v1",
      careerUpdatedAt: currentCareerUpdatedAt,
    }),
    cachedExplanation
  );
  assert.equal(
    findCachedCareerFitExplanation([cachedExplanation], {
      careerId: "career-1",
      strengthCode: "critical_thinking",
      elementScoresFingerprint: "profile-v2",
      careerUpdatedAt: currentCareerUpdatedAt,
    }),
    undefined
  );
});
