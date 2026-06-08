const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CAREER_CLUSTER_VALUES,
  formatCareerClusters,
  isValidCareerCluster,
  loadCareerClusterMap,
  normalizeCareerClusters,
} = require("./careerCluster");

test("normalizeCareerClusters trims, removes blanks and deduplicates values", () => {
  assert.deepEqual(
    normalizeCareerClusters(["Công nghệ số", "", " Công nghệ số ", null, "Giáo dục"]),
    ["Công nghệ số", "Giáo dục"]
  );
});

test("normalizeCareerClusters accepts semicolon and newline separated strings", () => {
  assert.deepEqual(
    normalizeCareerClusters("Công nghệ số;Giáo dục\nDịch vụ tài chính"),
    ["Công nghệ số", "Giáo dục", "Dịch vụ tài chính"]
  );
});

test("formatCareerClusters joins cluster arrays and uses fallback for empty values", () => {
  assert.equal(
    formatCareerClusters(["Công nghệ số", "Giáo dục"]),
    "Công nghệ số, Giáo dục"
  );
  assert.equal(formatCareerClusters([], "Chưa cập nhật"), "Chưa cập nhật");
});

test("career cluster values expose the fixed Vietnamese options", () => {
  assert.equal(CAREER_CLUSTER_VALUES.length, 14);
  assert.equal(isValidCareerCluster("Công nghệ số"), true);
  assert.equal(isValidCareerCluster("Information Technology"), false);
});

test("loadCareerClusterMap translates CSV file names and supports multi-cluster careers", () => {
  const { clusterByOnetCode } = loadCareerClusterMap();

  assert.deepEqual(clusterByOnetCode.get("15-1299.00"), [
    "Công nghệ số",
    "Dịch vụ công và an toàn",
  ]);
  assert.deepEqual(clusterByOnetCode.get("15-2099.00"), [
    "Năng lượng và tài nguyên thiên nhiên",
    "Dịch vụ tài chính",
    "Y tế và dịch vụ xã hội",
    "Quản lý và khởi nghiệp",
  ]);
});
