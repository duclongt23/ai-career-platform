const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findCachedCareerRoadmap,
  parseCareerRoadmap,
} = require("../../src/services/careerRoadmap.service");
const {
  buildCareerRoadmapMessages,
} = require("../../src/prompts/careerRoadmapPrompt");

const validRoadmap = {
  summary: "Lo trinh giup hoc sinh di tu nen tang, du an den ho so nghe nghiep.",
  phases: [
    {
      id: "khoi-dong",
      title: "Khoi dong",
      timeframe: "Ngay bay gio",
      focus: "Hieu nghe va cac ky nang cot loi can ren.",
      actions: ["Doc mo ta nghe", "Ghi lai cau hoi muon tim hieu"],
      checkpoint: "Noi duoc vi sao nghe nay hap dan ban.",
    },
    {
      id: "nen-tang",
      title: "Xay nen tang",
      timeframe: "1-2 thang",
      focus: "Tap trung mon hoc va kien thuc gan voi nghe.",
      actions: ["On kien thuc nen", "Lam bai tap ung dung"],
      checkpoint: "Hoan thanh mot san pham nho co giai thich.",
    },
    {
      id: "du-an",
      title: "Lam du an",
      timeframe: "Hoc ky toi",
      focus: "Bien kien thuc thanh san pham co the chia se.",
      actions: ["Chon mot de tai nho", "Nhan phan hoi tu thay co"],
      checkpoint: "Co mot du an dua vao portfolio.",
    },
    {
      id: "trai-nghiem",
      title: "Trai nghiem thuc te",
      timeframe: "Lop 11",
      focus: "Quan sat cach nghe nay xuat hien ngoai doi.",
      actions: ["Hoi nguoi trong nghe", "Tham gia CLB lien quan"],
      checkpoint: "Rut ra ba dieu can hoc tiep.",
    },
    {
      id: "ho-so",
      title: "Xay ho so",
      timeframe: "Lop 12",
      focus: "Tong hop du an, ky nang va ly do chon huong hoc.",
      actions: ["Cap nhat portfolio", "So sanh cac nganh hoc phu hop"],
      checkpoint: "Co danh sach lua chon sau THPT.",
    },
  ],
};

test("parseCareerRoadmap accepts a valid roadmap wrapped in a markdown fence", () => {
  assert.deepEqual(
    parseCareerRoadmap(`\`\`\`json\n${JSON.stringify(validRoadmap)}\n\`\`\``),
    validRoadmap
  );
});

test("parseCareerRoadmap rejects too few phases", () => {
  assert.throws(() =>
    parseCareerRoadmap(
      JSON.stringify({
        ...validRoadmap,
        phases: validRoadmap.phases.slice(0, 4),
      })
    )
  );
});

test("findCachedCareerRoadmap matches career and current career version", () => {
  const careerUpdatedAt = new Date("2026-06-01T00:00:00.000Z");
  const cachedEntry = {
    careerId: "career-1",
    careerUpdatedAt,
    summary: validRoadmap.summary,
    phases: validRoadmap.phases,
  };

  assert.equal(
    findCachedCareerRoadmap([cachedEntry], {
      careerId: "career-1",
      careerUpdatedAt,
    }),
    cachedEntry
  );
});

test("buildCareerRoadmapMessages includes career and element context", () => {
  const messages = buildCareerRoadmapMessages({
    career: {
      title_vi: "Lap trinh vien",
      description_vi: "Xay dung va bao tri phan mem.",
      careerCluster: ["Cong nghe thong tin"],
      riasecCode: "ICR",
    },
    keyElements: [
      {
        code: "programming",
        name_vi: "Lap trinh",
        importance: 0.9,
      },
    ],
  });

  assert.match(messages[1].content, /Lap trinh vien/);
  assert.match(messages[1].content, /Lap trinh/);
  assert.match(messages[1].content, /90%/);
});
