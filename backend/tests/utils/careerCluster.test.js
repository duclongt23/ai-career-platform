const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CAREER_CLUSTER_VALUES,
  formatCareerClusters,
  isValidCareerCluster,
  normalizeCareerClusters,
} = require("../../src/utils/careerCluster");

const digitalTechnology = CAREER_CLUSTER_VALUES[4];
const education = CAREER_CLUSTER_VALUES[5];
const financialServices = CAREER_CLUSTER_VALUES[7];

test("normalizeCareerClusters trims, removes blanks and deduplicates values", () => {
  assert.deepEqual(
    normalizeCareerClusters([
      digitalTechnology,
      "",
      ` ${digitalTechnology} `,
      null,
      education,
    ]),
    [digitalTechnology, education]
  );
});

test("normalizeCareerClusters accepts semicolon and newline separated strings", () => {
  assert.deepEqual(
    normalizeCareerClusters(
      `${digitalTechnology};${education}\n${financialServices}`
    ),
    [digitalTechnology, education, financialServices]
  );
});

test("formatCareerClusters joins cluster arrays and uses fallback for empty values", () => {
  assert.equal(
    formatCareerClusters([digitalTechnology, education]),
    `${digitalTechnology}, ${education}`
  );
  assert.equal(formatCareerClusters([], "Not updated"), "Not updated");
});

test("career cluster values expose the fixed Vietnamese options", () => {
  assert.equal(CAREER_CLUSTER_VALUES.length, 14);
  assert.equal(isValidCareerCluster(digitalTechnology), true);
  assert.equal(isValidCareerCluster("Information Technology"), false);
});
