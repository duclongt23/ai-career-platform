const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const ExcelJS = require("exceljs");
const Career = require("../models/Career");
const Element = require("../models/Element");
const { loadCareerClusterMap } = require("../utils/careerCluster");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const DATA_DIR = path.resolve(__dirname, "../../../data");
const ELEMENTS_CSV_PATH = path.resolve(__dirname, "../data/elements.csv");
const OCCUPATIONS_CSV_PATH = path.join(DATA_DIR, "Occupation_Data_ready.csv");
const RIASEC_XLSX_PATH = path.join(DATA_DIR, "onet_riasec_mapped.xlsx");
const CAREER_ELEMENT_SOURCES = [
  { fileName: "Abilities.xlsx", type: "ability", scaleId: "IM" },
  {
    fileName: "Essential Skills.xlsx",
    type: "essential_skill",
    scaleId: "IM",
  },
  { fileName: "Knowledge.xlsx", type: "knowledge", scaleId: "IM" },
  {
    fileName: "Transferable Skills.xlsx",
    type: "transferable_skill",
    scaleId: "IM",
  },
  { fileName: "Work Styles.xlsx", type: "workstyle", scaleId: "WI" },
];
const RIASEC_CODE_PATTERN = /^[RIASEC]{1,6}$/;

function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value.trim());
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function toCode(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    if (value.text !== undefined) {
      return String(value.text).trim();
    }

    if (value.result !== undefined) {
      return String(value.result).trim();
    }
  }

  return String(value).trim();
}

function getCellString(row, columnNumber) {
  return columnNumber ? getString(row.getCell(columnNumber).value) : "";
}

function getCellNumber(row, columnNumber) {
  const rawValue = row.getCell(columnNumber).value;
  const value =
    typeof rawValue === "object" && rawValue !== null && rawValue.result !== undefined
      ? rawValue.result
      : rawValue;
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Expected a numeric Data Value, received "${getString(value)}".`);
  }

  return number;
}

function getColumnNumbers(worksheet, requiredHeaders) {
  const headers = new Map();

  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    headers.set(getString(cell.value).replace(/^\uFEFF/, ""), columnNumber);
  });

  requiredHeaders.forEach((header) => {
    if (!headers.has(header)) {
      throw new Error(`Missing "${header}" column in ${worksheet.name}.`);
    }
  });

  return headers;
}

function toElementKey(type, nameEn) {
  return `${type}:${nameEn}`;
}

function toSourceElementKey(onetCode, elementName) {
  return `${onetCode}:${elementName}`;
}

function normalizeImportance(scaleId, value) {
  const scale =
    scaleId === "IM"
      ? { min: 1, max: 5 }
      : scaleId === "WI"
        ? { min: -3, max: 3 }
        : null;

  if (!scale) {
    throw new Error(`Unsupported importance scale "${scaleId}".`);
  }

  if (value < scale.min || value > scale.max) {
    throw new Error(
      `Value ${value} is outside the ${scaleId} scale range [${scale.min}, ${scale.max}].`
    );
  }

  return Number(((value - scale.min) / (scale.max - scale.min)).toFixed(4));
}

function loadElementCodes() {
  const [, ...rows] = parseCsv(fs.readFileSync(ELEMENTS_CSV_PATH, "utf8"));
  const elementCodes = new Map();
  const usedCodes = new Set();

  rows.forEach(([, nameEn, , type]) => {
    const baseCode = toCode(nameEn);
    const code = usedCodes.has(baseCode) ? `${baseCode}_${type}` : baseCode;
    const key = toElementKey(type, nameEn);

    if (!nameEn || !type || elementCodes.has(key)) {
      throw new Error(`Invalid or duplicate element definition "${key}".`);
    }

    usedCodes.add(code);
    elementCodes.set(key, code);
  });

  return elementCodes;
}

function loadCareers() {
  const [headers, ...rows] = parseCsv(
    fs.readFileSync(OCCUPATIONS_CSV_PATH, "utf8").replace(/^\uFEFF/, "")
  );
  const columnNumbers = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ["O*NET-SOC Code", "Title", "Mô tả", "Tiêu đề"];

  requiredHeaders.forEach((header) => {
    if (!columnNumbers.has(header)) {
      throw new Error(`Missing "${header}" column in Occupation_Data_ready.csv.`);
    }
  });

  const careers = new Map();

  rows.forEach((row) => {
    const onetCode = row[columnNumbers.get("O*NET-SOC Code")];

    if (!onetCode || careers.has(onetCode)) {
      throw new Error(`Invalid or duplicate occupation code "${onetCode}".`);
    }

    careers.set(onetCode, {
      onetCode,
      title_en: row[columnNumbers.get("Title")],
      title_vi: row[columnNumbers.get("Tiêu đề")],
      description_vi: row[columnNumbers.get("Mô tả")],
      careerCluster: [],
      riasecCode: "",
      elements: [],
      elementKeys: new Set(),
    });
  });

  return careers;
}

function addCareerClusters(careers) {
  const { clusterByOnetCode, stats } = loadCareerClusterMap();
  let matchedCount = 0;

  clusterByOnetCode.forEach((careerCluster, onetCode) => {
    const career = careers.get(onetCode);

    if (!career) {
      return;
    }

    career.careerCluster = careerCluster;
    matchedCount += 1;
  });

  return {
    matchedCount,
    sourceCount: clusterByOnetCode.size,
    stats,
  };
}

async function addCareerElements(careers, elementCodes, source) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(DATA_DIR, source.fileName));
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error(`${source.fileName} does not contain a worksheet.`);
  }

  const columns = getColumnNumbers(worksheet, [
    "O*NET-SOC Code",
    "Element Name",
    "Scale ID",
    "Data Value",
  ]);
  const notRelevantColumn = columns.get("Not Relevant");
  const excludedElements = new Set();

  if (notRelevantColumn) {
    worksheet.eachRow((row, rowNumber) => {
      if (
        rowNumber > 1 &&
        getCellString(row, notRelevantColumn).toUpperCase() === "Y"
      ) {
        excludedElements.add(
          toSourceElementKey(
            getCellString(row, columns.get("O*NET-SOC Code")),
            getCellString(row, columns.get("Element Name"))
          )
        );
      }
    });
  }

  let importedCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || getCellString(row, columns.get("Scale ID")) !== source.scaleId) {
      return;
    }

    const onetCode = getCellString(row, columns.get("O*NET-SOC Code"));
    const elementName = getCellString(row, columns.get("Element Name"));

    if (excludedElements.has(toSourceElementKey(onetCode, elementName))) {
      return;
    }

    const career = careers.get(onetCode);
    const elementCode = elementCodes.get(toElementKey(source.type, elementName));

    if (!career) {
      throw new Error(`${source.fileName} references unknown occupation "${onetCode}".`);
    }

    if (!elementCode) {
      throw new Error(`${source.fileName} references unknown ${source.type} "${elementName}".`);
    }

    const elementKey = `${source.type}:${elementCode}`;

    if (career.elementKeys.has(elementKey)) {
      throw new Error(`${source.fileName} contains duplicate element "${elementKey}" for "${onetCode}".`);
    }

    career.elementKeys.add(elementKey);
    career.elements.push({
      code: elementCode,
      type: source.type,
      importance: normalizeImportance(
        source.scaleId,
        getCellNumber(row, columns.get("Data Value"))
      ),
    });
    importedCount += 1;
  });

  return {
    fileName: source.fileName,
    excludedCount: excludedElements.size,
    importedCount,
  };
}

async function addRiasecCodes(careers) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(RIASEC_XLSX_PATH);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("onet_riasec_mapped.xlsx does not contain a worksheet.");
  }

  const columns = getColumnNumbers(worksheet, ["O*NET-SOC Code", "Holland_Code"]);
  let importedCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const onetCode = getCellString(row, columns.get("O*NET-SOC Code"));
    const riasecCode = getCellString(row, columns.get("Holland_Code")).toUpperCase();
    const career = careers.get(onetCode);

    if (!career) {
      throw new Error(`onet_riasec_mapped.xlsx references unknown occupation "${onetCode}".`);
    }

    if (!RIASEC_CODE_PATTERN.test(riasecCode)) {
      throw new Error(`Invalid RIASEC code "${riasecCode}" for occupation "${onetCode}".`);
    }

    if (career.riasecCode) {
      throw new Error(`Duplicate RIASEC code for occupation "${onetCode}".`);
    }

    career.riasecCode = riasecCode;
    importedCount += 1;
  });

  return importedCount;
}

function toCareerDocuments(careers) {
  return [...careers.values()].map(({ elementKeys, ...career }) => career);
}

function printStats(careers, sourceStats, riasecCount, careerClusterStats) {
  const careerDocuments = toCareerDocuments(careers);
  const careersWithElements = careerDocuments.filter((career) => career.elements.length).length;
  const elementCount = careerDocuments.reduce(
    (count, career) => count + career.elements.length,
    0
  );

  sourceStats.forEach(({ fileName, excludedCount, importedCount }) => {
    console.log(
      `${fileName}: imported ${importedCount} element weights, excluded ${excludedCount} not relevant elements.`
    );
  });
  careerClusterStats.stats.forEach(({ fileName, clusterName, importedCount }) => {
    console.log(`${fileName}: mapped ${importedCount} rows to "${clusterName}".`);
  });
  console.log(
    `Prepared ${careerDocuments.length} careers and ${elementCount} element weights. ` +
      `${careersWithElements} careers have elements; ${careerDocuments.length - careersWithElements} do not.`
  );
  console.log(
    `RIASEC codes: ${riasecCount} present; ${careerDocuments.length - riasecCount} missing.`
  );
  console.log(
    `Career clusters: ${careerClusterStats.matchedCount} careers matched from ${careerClusterStats.sourceCount} O*NET codes in career_cluster.`
  );
}

async function assertElementsExist(careers) {
  const requiredCodes = [
    ...new Set(
      toCareerDocuments(careers).flatMap((career) =>
        career.elements.map((element) => element.code)
      )
    ),
  ];
  const existingElements = await Element.find({ code: { $in: requiredCodes } })
    .select("code")
    .lean();
  const existingCodes = new Set(existingElements.map((element) => element.code));
  const missingCodes = requiredCodes.filter((code) => !existingCodes.has(code));

  if (missingCodes.length) {
    throw new Error(
      `Missing ${missingCodes.length} elements in MongoDB. Run "npm run seed:elements" first.`
    );
  }
}

async function seedCareers() {
  const dryRun = process.argv.includes("--dry-run");
  const careers = loadCareers();
  const elementCodes = loadElementCodes();
  const careerClusterStats = addCareerClusters(careers);
  const sourceStats = [];

  for (const source of CAREER_ELEMENT_SOURCES) {
    sourceStats.push(await addCareerElements(careers, elementCodes, source));
  }

  const riasecCount = await addRiasecCodes(careers);
  printStats(careers, sourceStats, riasecCount, careerClusterStats);

  if (dryRun) {
    console.log("Dry run completed. MongoDB was not modified.");
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to backend/.env before running this script.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  await assertElementsExist(careers);

  const operations = toCareerDocuments(careers).map((career) => ({
    updateOne: {
      filter: { onetCode: career.onetCode },
      update: { $set: career },
      upsert: true,
    },
  }));
  const result = await Career.bulkWrite(operations, { ordered: false });

  console.log(
    `Seeded careers. Inserted: ${result.upsertedCount || 0}, updated: ${result.modifiedCount || 0}.`
  );
}

seedCareers()
  .catch((error) => {
    console.error("Failed to seed careers:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
