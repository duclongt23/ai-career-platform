const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Element = require("../models/Element");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const csvPath = path.resolve(__dirname, "../data/elements.csv");

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

async function seedElements() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to backend/.env before running this script.");
  }

  const content = fs.readFileSync(csvPath, "utf8");
  const [, ...dataRows] = parseCsv(content);

  const operations = dataRows.map(([nameVi, nameEn, descriptionVi, type]) => {
    const code = toCode(nameEn);

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
          },
        },
        upsert: true,
      },
    };
  });

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
