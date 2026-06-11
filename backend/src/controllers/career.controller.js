const {
  createCareer: createCareerRecord,
  deleteCareer: deleteCareerRecord,
  getCareerDetails,
  listAdminCareers,
  listCareers,
  searchCareerElements,
  updateCareer: updateCareerRecord,
} = require("../services/career.service");
const {
  getCareerRecommendationsForUser,
} = require("../services/careerRecommendationWorkflow.service");
const {
  getCareerDayInLife,
  getCareerFitExplanation,
} = require("../services/careerInsight.service");

function sendError(res, error, fallbackMessage) {
  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : fallbackMessage,
    error: error.message,
  });
}

async function listRecommendations(req, res) {
  try {
    return res.json(await getCareerRecommendationsForUser(req.user._id));
  } catch (error) {
    return sendError(res, error, "Server error");
  }
}

async function createFitExplanation(req, res) {
  try {
    return res.json(
      await getCareerFitExplanation({
        userId: req.user._id,
        careerId: req.params.id,
        selectedStrengthCode: req.body?.selectedStrengthCode,
        regenerate: req.body?.regenerate,
      })
    );
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Không thể tạo lý do phù hợp lúc này. Vui lòng thử lại.",
    });
  }
}

async function createDayInLife(req, res) {
  try {
    return res.json(
      await getCareerDayInLife({
        userId: req.user._id,
        careerId: req.params.id,
        regenerate: req.body?.regenerate,
      })
    );
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Không thể tạo lịch làm việc lúc này. Vui lòng thử lại.",
    });
  }
}

async function searchAdminElements(req, res) {
  try {
    const elements = await searchCareerElements(req.query);

    return res.json({ elements });
  } catch (error) {
    return sendError(res, error, "Failed to search elements");
  }
}

async function listAdmin(req, res) {
  try {
    return res.json(await listAdminCareers(req.query));
  } catch (error) {
    return sendError(res, error, "Server error");
  }
}

async function listPublic(req, res) {
  try {
    return res.json(await listCareers(req.query));
  } catch (error) {
    return sendError(res, error, "Server error");
  }
}

async function getById(req, res) {
  try {
    return res.json(await getCareerDetails(req.params.id));
  } catch (error) {
    return sendError(res, error, "Server error");
  }
}

async function createCareer(req, res) {
  try {
    const career = await createCareerRecord(req.body);

    return res.status(201).json({
      message: "Career created successfully",
      career,
    });
  } catch (error) {
    return sendError(res, error, "Server error");
  }
}

async function updateCareer(req, res) {
  try {
    const career = await updateCareerRecord(req.params.id, req.body);

    return res.json({
      message: "Career updated successfully",
      career,
    });
  } catch (error) {
    return sendError(res, error, "Server error");
  }
}

async function deleteCareer(req, res) {
  try {
    await deleteCareerRecord(req.params.id);

    return res.json({
      message: "Career deleted successfully",
    });
  } catch (error) {
    return sendError(res, error, "Server error");
  }
}

module.exports = {
  createCareer,
  createDayInLife,
  createFitExplanation,
  deleteCareer,
  getById,
  listAdmin,
  listPublic,
  listRecommendations,
  searchAdminElements,
  updateCareer,
};
