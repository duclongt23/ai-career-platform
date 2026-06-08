const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Career = require("../models/Career");
const { loadCareerClusterMap } = require("../utils/careerCluster");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function updateCareerClusters() {
  const dryRun = process.argv.includes("--dry-run");
  const { clusterByOnetCode, stats } = loadCareerClusterMap();

  stats.forEach(({ fileName, clusterName, importedCount }) => {
    console.log(`${fileName}: mapped ${importedCount} rows to "${clusterName}".`);
  });

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to backend/.env before running this script.");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const onetCodes = [...clusterByOnetCode.keys()];
  const existingCareers = await Career.find({ onetCode: { $in: onetCodes } })
    .select("onetCode")
    .lean();
  const existingCodes = new Set(existingCareers.map((career) => career.onetCode));
  const operations = onetCodes
    .filter((onetCode) => existingCodes.has(onetCode))
    .map((onetCode) => ({
      updateOne: {
        filter: { onetCode },
        update: {
          $set: {
            careerCluster: clusterByOnetCode.get(onetCode),
          },
        },
      },
    }));
  const missingCount = onetCodes.length - operations.length;

  console.log(
    `Prepared ${operations.length} career cluster updates. ${missingCount} O*NET codes from career_cluster were not found in MongoDB.`
  );

  if (dryRun) {
    console.log("Dry run completed. MongoDB was not modified.");
    return;
  }

  if (!operations.length) {
    console.log("No matching careers to update.");
    return;
  }

  const result = await Career.bulkWrite(operations, { ordered: false });

  console.log(
    `Updated career clusters. Matched: ${result.matchedCount || 0}, modified: ${result.modifiedCount || 0}.`
  );
}

updateCareerClusters()
  .catch((error) => {
    console.error("Failed to update career clusters:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
