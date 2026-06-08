const fs = require("fs");
const path = require("path");

const CAREER_CLUSTER_DIR = path.resolve(__dirname, "../../../career_cluster");

const CAREER_CLUSTER_TRANSLATIONS = {
  Advanced_Manufacturing: "Sản xuất tiên tiến",
  Agriculture: "Nông nghiệp",
  Arts_Entertainment_Design: "Nghệ thuật, giải trí và thiết kế",
  Construction: "Xây dựng",
  Digital_Technology: "Công nghệ số",
  Education: "Giáo dục",
  Energy_Natural_Resources: "Năng lượng và tài nguyên thiên nhiên",
  Financial_Services: "Dịch vụ tài chính",
  Healthcare_Human_Services: "Y tế và dịch vụ xã hội",
  Hospitality_Events_Tourism: "Khách sạn, sự kiện và du lịch",
  Management_Entrepreneurship: "Quản lý và khởi nghiệp",
  Marketing_Sales: "Tiếp thị và bán hàng",
  Public_Service_Safety: "Dịch vụ công và an toàn",
  Supply_Chain_Transportation: "Chuỗi cung ứng và vận tải",
};

const CAREER_CLUSTER_VALUES = Object.values(CAREER_CLUSTER_TRANSLATIONS);
const CAREER_CLUSTER_VALUE_SET = new Set(CAREER_CLUSTER_VALUES);

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

function normalizeCareerClusters(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[;\n]/)
        .map((item) => item.trim());
  const seen = new Set();

  return values
    .map((item) => String(item || "").trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });
}

function formatCareerClusters(value, fallback = "") {
  const clusters = normalizeCareerClusters(value);
  return clusters.length ? clusters.join(", ") : fallback;
}

function isValidCareerCluster(value) {
  return CAREER_CLUSTER_VALUE_SET.has(String(value || "").trim());
}

function toFallbackClusterName(fileName) {
  return path.basename(fileName, ".csv").replace(/_/g, " ");
}

function loadCareerClusterMap(clusterDir = CAREER_CLUSTER_DIR) {
  const clusterByOnetCode = new Map();
  const stats = [];

  if (!fs.existsSync(clusterDir)) {
    throw new Error(`Career cluster directory not found: ${clusterDir}`);
  }

  const fileNames = fs
    .readdirSync(clusterDir)
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
    .sort((left, right) => left.localeCompare(right));

  fileNames.forEach((fileName) => {
    const clusterKey = path.basename(fileName, ".csv");
    const clusterName =
      CAREER_CLUSTER_TRANSLATIONS[clusterKey] || toFallbackClusterName(fileName);
    const rows = parseCsv(
      fs.readFileSync(path.join(clusterDir, fileName), "utf8").replace(/^\uFEFF/, "")
    );
    const [headers, ...dataRows] = rows;

    if (!headers?.length) {
      throw new Error(`${fileName} is empty.`);
    }

    const columns = new Map(headers.map((header, index) => [header, index]));
    const codeIndex = columns.get("Code");

    if (codeIndex === undefined) {
      throw new Error(`${fileName} is missing the "Code" column.`);
    }

    let importedCount = 0;

    dataRows.forEach((row) => {
      const onetCode = row[codeIndex];

      if (!onetCode) {
        return;
      }

      const existingClusters = clusterByOnetCode.get(onetCode) || [];

      if (!existingClusters.includes(clusterName)) {
        clusterByOnetCode.set(onetCode, [...existingClusters, clusterName]);
      }

      importedCount += 1;
    });

    stats.push({
      fileName,
      clusterName,
      importedCount,
    });
  });

  return {
    clusterByOnetCode,
    stats,
  };
}

module.exports = {
  CAREER_CLUSTER_TRANSLATIONS,
  CAREER_CLUSTER_VALUES,
  formatCareerClusters,
  isValidCareerCluster,
  loadCareerClusterMap,
  normalizeCareerClusters,
};
