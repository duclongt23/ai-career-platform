const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const ProfilingQuestion = require("../models/ProfilingQuestion");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const questionsPath = path.resolve(__dirname, "../../../QAprofiling.json");

function validateQuestion(question) {
  if (!question.question_id || !question.target_type || !question.question || !Array.isArray(question.answers)) {
    throw new Error(`Invalid profiling question payload: ${question.question_id || "unknown"}`);
  }

  if (question.answers.length < 4 || question.answers.length > 6) {
    throw new Error(`${question.question_id} must have 4 to 6 answers.`);
  }

  const hasNeutralAnswer = question.answers.some((answer) => {
    return !answer.mapping || Object.keys(answer.mapping).length === 0;
  });

  if (!hasNeutralAnswer) {
    throw new Error(`${question.question_id} must have at least one neutral answer.`);
  }
}

async function seedProfilingQuestions() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to backend/.env before running this script.");
  }

  const questions = JSON.parse(fs.readFileSync(questionsPath, "utf8"));

  if (!Array.isArray(questions)) {
    throw new Error("QAprofiling.json must contain a JSON array.");
  }

  const operations = questions.map((question) => {
    validateQuestion(question);

    return {
      updateOne: {
        filter: { question_id: question.question_id },
        update: {
          $set: {
            ...question,
            is_active: true,
          },
        },
        upsert: true,
      },
    };
  });

  await mongoose.connect(process.env.MONGO_URI);

  const result = operations.length
    ? await ProfilingQuestion.bulkWrite(operations, { ordered: false })
    : {};

  console.log(
    `Seeded ${operations.length} profiling questions. Inserted: ${result.upsertedCount || 0}, updated: ${
      result.modifiedCount || 0
    }.`
  );

  await mongoose.disconnect();
}

seedProfilingQuestions().catch(async (error) => {
  console.error("Failed to seed profiling questions:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
