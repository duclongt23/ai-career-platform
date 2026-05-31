const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Element = require("../models/Element");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const csvPath = path.resolve(__dirname, "../data/elements.csv");
const classificationsPath = path.resolve(
  __dirname,
  "../data/elementRiasecClassifications.json"
);
const RIASEC_TYPES = new Set(["R", "I", "A", "S", "E", "C"]);

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

function toClassificationKey(type, nameEn) {
  return `${type}:${nameEn}`;
}

function loadClassifications() {
  const classifications = JSON.parse(fs.readFileSync(classificationsPath, "utf8"));
  const classificationMap = new Map();

  classifications.forEach(({ type, name_en: nameEn, riasec_tags: tags, riasec_weights: weights }) => {
    const key = toClassificationKey(type, nameEn);
    const weightKeys = Object.keys(weights);

    if (
      classificationMap.has(key) ||
      !Array.isArray(tags) ||
      tags.length > 3 ||
      new Set(tags).size !== tags.length ||
      tags.some((tag) => !RIASEC_TYPES.has(tag)) ||
      weightKeys.length !== tags.length ||
      weightKeys.some((tag) => !tags.includes(tag)) ||
      Object.values(weights).some((weight) => weight < 0.1 || weight > 1)
    ) {
      throw new Error(`Invalid RIASEC classification for ${key}.`);
    }

    classificationMap.set(key, { riasec_tags: tags, riasec_weights: weights });
  });

  return classificationMap;
}

async function seedElements() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to backend/.env before running this script.");
  }

  const content = fs.readFileSync(csvPath, "utf8");
  const [, ...dataRows] = parseCsv(content);
  const classifications = loadClassifications();
  const usedCodes = new Set();

  const operations = dataRows.map(([nameVi, nameEn, descriptionVi, type]) => {
    const baseCode = toCode(nameEn);
    const code = usedCodes.has(baseCode) ? `${baseCode}_${type}` : baseCode;
    const classificationKey = toClassificationKey(type, nameEn);
    const classification = classifications.get(classificationKey);

    if (!classification) {
      throw new Error(`Missing RIASEC classification for ${classificationKey}.`);
    }

    usedCodes.add(code);
    classifications.delete(classificationKey);

    return {
      updateOne: {
        filter: { code },
        update: {
          $set: {
            code,
            name_vi: nameVi,
            name_en: nameEn,
            type,
            description_vi: descriptionVi,
            student_friendly_description: "",
            is_active: true,
            student_suitable: true,
            ...classification,
          },
        },
        upsert: true,
      },
    };
  });

  if (classifications.size) {
    throw new Error(
      `RIASEC classifications contain ${classifications.size} element(s) not found in elements.csv.`
    );
  }

  await mongoose.connect(process.env.MONGO_URI);

  const result = operations.length ? await Element.bulkWrite(operations) : {};
  console.log(
    `Seeded ${operations.length} elements. Inserted: ${result.upsertedCount || 0}, updated: ${result.modifiedCount || 0}.`
  );

  await mongoose.disconnect();
}

seedElements().catch(async (error) => {
  console.error("Failed to seed elements:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
