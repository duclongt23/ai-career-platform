const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const {
  DEFAULT_AI_CONFIDENCE,
  MAX_STORED_MESSAGES,
} = require("../constants/aiDiscovery");
const AiDiscoverySession = require("../models/AiDiscovery");
const ProfilingQuestion = require("../models/ProfilingQuestion");
const StudentProfile = require("../models/StudentProfile");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function getNormalizedContribution(expression) {
  return {
    $cond: [
      {
        $and: [
          { $isNumber: expression },
          { $gte: [expression, 0.1] },
          { $lte: [expression, 1] },
        ],
      },
      expression,
      DEFAULT_AI_CONFIDENCE,
    ],
  };
}

async function migrateOptimizedSchemas() {
  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI is missing. Add it to backend/.env before running this script."
    );
  }

  await mongoose.connect(process.env.MONGO_URI);

  const [profileResult, sessionResult, questionResult] = await Promise.all([
    StudentProfile.collection.updateMany(
      { "aiDiscoveries.0": { $exists: true } },
      [
        {
          $set: {
            aiDiscoveries: {
              $map: {
                input: "$aiDiscoveries",
                as: "discovery",
                in: {
                  sessionId: "$$discovery.sessionId",
                  confirmedElements: {
                    $map: {
                      input: {
                        $ifNull: ["$$discovery.confirmedElements", []],
                      },
                      as: "element",
                      in: {
                        code: "$$element.code",
                        type: "$$element.type",
                        level: "$$element.level",
                        contribution: getNormalizedContribution(
                          "$$element.contribution"
                        ),
                      },
                    },
                  },
                  createdAt: "$$discovery.createdAt",
                },
              },
            },
          },
        },
      ]
    ),
    AiDiscoverySession.collection.updateMany({}, [
      {
        $set: {
          messages: {
            $slice: [{ $ifNull: ["$messages", []] }, -MAX_STORED_MESSAGES],
          },
          confirmedElements: {
            $map: {
              input: { $ifNull: ["$confirmedElements", []] },
              as: "element",
              in: {
                $mergeObjects: [
                  "$$element",
                  {
                    contribution: getNormalizedContribution(
                      "$$element.contribution"
                    ),
                  },
                ],
              },
            },
          },
        },
      },
    ]),
    ProfilingQuestion.collection.updateMany({}, [
      {
        $set: {
          target_elements: {
            $map: {
              input: { $ifNull: ["$target_elements", []] },
              as: "element",
              in: {
                code: {
                  $toLower: {
                    $trim: {
                      input: "$$element.code",
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]),
  ]);

  console.log(
    `Migrated profiles: ${profileResult.modifiedCount || 0}, sessions: ${
      sessionResult.modifiedCount || 0
    }, profiling questions: ${questionResult.modifiedCount || 0}.`
  );

  await mongoose.disconnect();
}

migrateOptimizedSchemas().catch(async (error) => {
  console.error("Failed to migrate optimized schemas:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
