const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFallbackProfileInsights,
  parseProfileSummaryInsights,
} = require("../../src/services/profileSummaryInsight.service");

test("parseProfileSummaryInsights accepts a valid fenced JSON response", () => {
  const insights = parseProfileSummaryInsights(
    '```json\n{"insights":[{"title":"Thiên về phân tích","description":"Bạn có xu hướng tìm hiểu vấn đề trước khi quyết định."},{"title":"Tự học là điểm tựa","description":"Dữ liệu cho thấy khả năng tự học có thể hỗ trợ quá trình khám phá nghề."},{"title":"Nên xem nhóm công nghệ","description":"Một số nghề gợi ý đang lặp lại ở nhóm công nghệ và dữ liệu."}]}\n```'
  );

  assert.equal(insights.length, 3);
  assert.equal(insights[0].title, "Thiên về phân tích");
});

test("parseProfileSummaryInsights rejects too few insights", () => {
  assert.throws(() =>
    parseProfileSummaryInsights(
      '{"insights":[{"title":"Một insight","description":"Chưa đủ số lượng."}]}'
    )
  );
});

test("buildFallbackProfileInsights always returns at least three insights", () => {
  const insights = buildFallbackProfileInsights({
    topRiasec: [],
    topElements: [],
    topCareerClusters: [],
    topRecommendedCareers: [],
  });

  assert.equal(insights.length, 3);
  assert.equal(insights.every((insight) => insight.title && insight.description), true);
});
