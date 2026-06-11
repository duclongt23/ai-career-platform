const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findCachedCareerDayInLife,
  parseCareerDayInLife,
} = require("../../src/services/careerDayInLife.service");
const {
  buildCareerDayInLifeMessages,
} = require("../../src/prompts/careerDayInLifePrompt");

test("parseCareerDayInLife accepts a valid activity list wrapped in a markdown fence", () => {
  assert.deepEqual(
    parseCareerDayInLife(
      '```json\n{"activities":["Hoạt động 1","Hoạt động 2","Hoạt động 3","Hoạt động 4","Hoạt động 5"]}\n```'
    ),
    ["Hoạt động 1", "Hoạt động 2", "Hoạt động 3", "Hoạt động 4", "Hoạt động 5"]
  );
});

test("parseCareerDayInLife rejects a list that is too short", () => {
  assert.throws(() =>
    parseCareerDayInLife('{"activities":["Một","Hai","Ba","Bốn"]}')
  );
});

test("findCachedCareerDayInLife matches career and current career version", () => {
  const careerUpdatedAt = new Date("2026-06-01T00:00:00.000Z");
  const cachedEntry = {
    careerId: "career-1",
    careerUpdatedAt,
    activities: ["Một", "Hai", "Ba", "Bốn", "Năm"],
  };

  assert.equal(
    findCachedCareerDayInLife([cachedEntry], {
      careerId: "career-1",
      careerUpdatedAt,
    }),
    cachedEntry
  );
});

test("buildCareerDayInLifeMessages includes career context", () => {
  const messages = buildCareerDayInLifeMessages({
    career: {
      title_vi: "Lập trình viên",
      description_vi: "Xây dựng và bảo trì phần mềm.",
    },
  });

  assert.match(messages[1].content, /Lập trình viên/);
  assert.match(messages[1].content, /Xây dựng và bảo trì phần mềm/);
});
