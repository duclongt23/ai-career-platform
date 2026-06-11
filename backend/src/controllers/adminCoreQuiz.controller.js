const {
  createQuestion: createQuestionService,
  deleteQuestion: deleteQuestionService,
  listQuestions: listQuestionsService,
  searchQuestionElements: searchQuestionElementsService,
  updateQuestion: updateQuestionService,
} = require("../services/adminCoreQuiz.service");

async function searchElements(req, res) {
  try {
    const elements = await searchQuestionElementsService(req.query);

    return res.json({ elements });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to search elements",
      error: error.message,
    });
  }
}

async function listQuestions(req, res) {
  try {
    return res.json(await listQuestionsService());
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load profiling questions",
      error: error.message,
    });
  }
}

async function createQuestion(req, res) {
  try {
    const question = await createQuestionService(req.body);

    return res.status(201).json({
      message: "Profiling question created successfully",
      question,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.statusCode
        ? error.message
        : "Failed to create profiling question",
      error: error.message,
    });
  }
}

async function updateQuestion(req, res) {
  try {
    const question = await updateQuestionService(req.params.id, req.body);

    return res.json({
      message: "Profiling question updated successfully",
      question,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.statusCode
        ? error.message
        : "Failed to update profiling question",
      error: error.message,
    });
  }
}

async function deleteQuestion(req, res) {
  try {
    const affectedProfiles = await deleteQuestionService(req.params.id);

    return res.json({
      message: "Profiling question deleted successfully",
      affectedProfiles,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to delete profiling question",
      error: error.message,
    });
  }
}

module.exports = {
  createQuestion,
  deleteQuestion,
  listQuestions,
  searchElements,
  updateQuestion,
};
